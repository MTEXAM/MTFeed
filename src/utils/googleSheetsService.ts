import { SessionUser, Post } from '../types';

export const GOOGLE_SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz1ZrKFZIHSnhlc6BQd_WvmOdHGa8ENQ6CuIu-MbPdWtgAtVj4WuzUgF6xtbtmFuPoBmQ/exec';

/**
 * 1. Sync user profile to Google Sheets via server proxy / Apps Script
 * Payload format: { action: 'updateProfile', uid, username, displayName, profileImage }
 */
export async function syncProfileToGoogleSheets(user: Partial<SessionUser>): Promise<boolean> {
  if (!user) return false;
  const uid = user.uid || user.id;
  if (!uid) return false;

  const payload = {
    action: 'updateProfile',
    uid: uid,
    username: user.username ? user.username.replace(/^@/, '') : '',
    displayName: user.name || user.username || 'User',
    profileImage: user.avatar || ''
  };

  try {
    // 1. Try server proxy (which handles background queue & avoids CORS)
    const res = await fetch('/api/sheets/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log('[SHEETS SYNC] Profile synced to Google Sheets via server proxy');
      return true;
    }
  } catch (err) {
    console.warn('[SHEETS SYNC] Server proxy failed, trying direct Apps Script fetch...', err);
  }

  try {
    // 2. Fallback to direct client-side fetch
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    console.log('[SHEETS SYNC] Profile sent directly to Google Sheets Apps Script');
    return true;
  } catch (err) {
    console.error('[SHEETS SYNC ERROR] Direct sync to Google Sheets failed:', err);
    return false;
  }
}

// Set to track synced post IDs to avoid infinite loops and duplicate submissions
const syncedPostsSet = new Set<string>();

/**
 * 2. Sync created tweet / post to Google Sheets via server proxy / Apps Script
 * Payload format: { action: 'createPost', uid, content }
 */
export async function syncPostToGoogleSheets(post: Post): Promise<boolean> {
  if (!post || !post.content || !post.id) return false;

  // Prevent duplicate syncing of the exact same post ID
  if (syncedPostsSet.has(post.id)) {
    return true;
  }
  syncedPostsSet.add(post.id);

  // If post came from Google Sheets itself, do not re-send
  if (post.id.startsWith('POST_') || post.id.startsWith('TWEET_') || post.id.startsWith('sheet_post_') || (post.tags && post.tags.includes('#GoogleSheetPermanent'))) {
    return true;
  }

  const payload = {
    action: 'createPost',
    uid: (post.author as any)?.uid || post.author?.id || '#MED68001',
    content: post.content
  };

  try {
    // 1. Try server proxy
    const res = await fetch('/api/sheets/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log('[SHEETS SYNC] Post synced to Google Sheets via server proxy');
      return true;
    }
  } catch (err) {
    console.warn('[SHEETS SYNC] Server proxy post sync failed, trying direct fetch...', err);
  }

  try {
    // 2. Direct fallback
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    console.log('[SHEETS SYNC] Post sent directly to Google Sheets Apps Script');
    return true;
  } catch (err) {
    console.error('[SHEETS SYNC ERROR] Direct post sync to Google Sheets failed:', err);
    return false;
  }
}

/**
 * 3. Edit post in Google Sheets via server proxy / Apps Script
 * Payload format: { action: 'editPost', postId, uid, newContent }
 */
export async function syncEditPostToGoogleSheets(postId: string, uid: string, newContent: string): Promise<boolean> {
  if (!postId || !uid || !newContent) return false;

  const payload = {
    action: 'editPost',
    postId,
    uid,
    newContent
  };

  try {
    const res = await fetch('/api/sheets/editPost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log('[SHEETS SYNC] Post edit synced to Google Sheets');
      return true;
    }
  } catch (err) {
    console.warn('[SHEETS SYNC] Server proxy edit sync failed, trying direct fetch...', err);
  }

  try {
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    console.error('[SHEETS SYNC ERROR] Edit sync to Google Sheets failed:', err);
    return false;
  }
}

/**
 * 4. Fetch timeline feed from Google Sheets
 * Calls: ?action=getFeed
 */
export async function fetchFeedFromGoogleSheets(): Promise<Post[]> {
  try {
    // Try server proxy first
    const res = await fetch('/api/sheets/feed');
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        return mapSheetFeedToPosts(json.data);
      }
    }
  } catch (e) {
    console.warn('[SHEETS FETCH] Server proxy feed fetch failed, attempting direct fetch...', e);
  }

  try {
    // Direct fetch
    const res = await fetch(`${GOOGLE_SHEETS_ENDPOINT}?action=getFeed`);
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        return mapSheetFeedToPosts(json.data);
      }
    }
  } catch (e) {
    console.error('[SHEETS FETCH ERROR] Failed to fetch feed from Google Sheets:', e);
  }

  return [];
}

/**
 * Map raw sheet rows to Post objects using exact Apps Script schema:
 * { postId, uid, displayName, username, profileImage, content, timestamp }
 */
function mapSheetFeedToPosts(sheetRows: any[]): Post[] {
  return sheetRows.map((row: any, idx: number) => {
    const rawTime = row.timestamp ? new Date(row.timestamp).getTime() : (Date.now() - idx * 60000);
    const dateObj = new Date(rawTime);
    const dateFormatted = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) + ' • ' + dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : 'เมื่อสักครู่';

    const displayName = row.displayName || row.author || 'User';
    const username = (row.username || displayName).replace(/^@/, '').toLowerCase().replace(/\s+/g, '_');
    const avatar = row.profileImage || row.authorImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;

    return {
      id: row.postId || `sheet_post_${rawTime}_${idx}`,
      author: {
        id: row.uid || 'MED68001',
        uid: row.uid || 'MED68001',
        name: displayName,
        username: username,
        avatar: avatar,
        userGroup: '🔬 นักเทคนิคการแพทย์',
        academicYear: 'ปี 4',
        faculty: 'คณะเทคนิคการแพทย์'
      },
      content: row.content || '',
      tags: ['#GoogleSheetPermanent'],
      createdAt: dateFormatted,
      createdAtMs: rawTime,
      stats: {
        replies: 0,
        reposts: 0,
        likes: 0,
        bookmarks: 0
      }
    };
  });
}

/**
 * Fetch profile from Google Sheets
 */
export async function fetchProfileFromGoogleSheets(uid: string): Promise<SessionUser | null> {
  if (!uid) return null;
  try {
    const res = await fetch(`/api/sheets/profile/${encodeURIComponent(uid)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        return {
          id: json.data.uid,
          uid: json.data.uid,
          username: (json.data.username || 'user').replace(/^@/, ''),
          name: json.data.displayName || json.data.username || 'User',
          avatar: json.data.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(json.data.username || 'user')}`,
          isAdmin: false,
          userGroup: '🔬 นักเทคนิคการแพทย์',
          academicYear: 'ปี 4',
          faculty: 'คณะเทคนิคการแพทย์'
        };
      }
    }
  } catch (e) {
    console.warn('[SHEETS PROFILE FETCH] Failed to fetch profile from Google Sheets:', e);
  }
  return null;
}
