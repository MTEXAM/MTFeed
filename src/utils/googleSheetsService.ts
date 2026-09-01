import { SessionUser, Post } from '../types';
import { systemHealthManager } from './systemHealthService';

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
  if (post.id.startsWith('POST_') || post.id.startsWith('TWEET_') || post.id.startsWith('sheet_') || (post.tags && post.tags.includes('#GoogleSheetPermanent'))) {
    return true;
  }

  const mediaDesc = [
    post.image ? '[แนบรูปภาพ]' : '',
    post.pdf ? `[แนบไฟล์ PDF: ${post.pdf.name}]` : ''
  ].filter(Boolean).join(' ');

  const contentWithMedia = mediaDesc ? `${post.content}\n${mediaDesc}` : post.content;

  const payload = {
    action: 'createPost',
    uid: (post.author as any)?.uid || post.author?.id || '#MED68001',
    content: contentWithMedia,
    image: post.image && post.image.length < 5000 ? post.image : ''
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
 * 4. Delete post in Google Sheets via server proxy / Apps Script
 * Payload format: { action: 'deletePost', postId, uid, content }
 */
export async function syncDeletePostToGoogleSheets(postId: string, content?: string, uid?: string): Promise<boolean> {
  if (!postId) return false;

  const payload = {
    action: 'deletePost',
    postId,
    uid: uid || '',
    content: content || ''
  };

  try {
    const res = await fetch('/api/sheets/deletePost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      console.log('[SHEETS SYNC] Post deletion synced to Google Sheets via server proxy');
      return true;
    }
  } catch (err) {
    console.warn('[SHEETS SYNC] Server proxy delete sync failed, trying direct fetch...', err);
  }

  try {
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    console.log('[SHEETS SYNC] Post delete sent directly to Google Sheets Apps Script');
    return true;
  } catch (err) {
    console.error('[SHEETS SYNC ERROR] Delete sync to Google Sheets failed:', err);
    return false;
  }
}

/**
 * 4. Fetch timeline feed from Google Sheets
 * Calls: ?action=getFeed
 */
export async function fetchFeedFromGoogleSheets(): Promise<Post[]> {
  const timestamp = Date.now();
  try {
    // Try server proxy first (cache-busted)
    const res = await fetch(`/api/sheets/feed?_t=${timestamp}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        systemHealthManager.reportSheetsSuccess();
        return mapSheetFeedToPosts(json.data);
      }
    }
  } catch (e) {
    console.warn('[SHEETS FETCH] Server proxy feed fetch failed, attempting direct fetch...', e);
  }

  try {
    // Direct fetch (cache-busted)
    const res = await fetch(`${GOOGLE_SHEETS_ENDPOINT}?action=getFeed&_t=${timestamp}`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        systemHealthManager.reportSheetsSuccess();
        return mapSheetFeedToPosts(json.data);
      }
    }
  } catch (e) {
    console.error('[SHEETS FETCH ERROR] Failed to fetch feed from Google Sheets:', e);
    systemHealthManager.reportSheetsError();
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
    const uid = row.uid || '#MED68001';
    
    // Stable ID: prefer postId, or construct stable deterministic ID from timestamp/content
    const stableId = row.postId 
      ? String(row.postId)
      : (row.timestamp ? `sheet_time_${new Date(row.timestamp).getTime()}` : `sheet_row_${idx}`);

    let contentStr = typeof row.content === 'string' ? row.content : (row.content ? String(row.content) : '');
    let extractedImage = row.image || undefined;
    
    if (!extractedImage) {
      const imageMatch = contentStr.match(/(https?:\/\/[^\s]+(?:jpg|jpeg|png|gif|webp|unsplash\.com)[^\s]*)/i);
      if (imageMatch) {
        extractedImage = imageMatch[0];
        // Clean up the URL from the end of the text if we added it there
        contentStr = contentStr.replace(extractedImage, '').trim();
      }
    }

    return {
      id: stableId,
      author: {
        id: uid,
        uid: uid,
        name: displayName,
        username: username,
        avatar: avatar,
        ...(row.userGroup ? { userGroup: row.userGroup } : {}),
        ...(row.academicYear ? { academicYear: row.academicYear } : {}),
        ...(row.faculty ? { faculty: row.faculty } : {}),
        ...(row.isAdmin ? { isAdmin: row.isAdmin, badge: '👑 Admin' } : {})
      },
      content: contentStr,
      image: extractedImage,
      tags: typeof contentStr === 'string' ? (contentStr.match(/#[\w\u0E00-\u0E7F]+/g) || []) : [],
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
 * Extract distinct user profiles present in Google Sheets feed
 */
export function extractProfilesFromSheetPosts(sheetPosts: Post[]): SessionUser[] {
  const userMap = new Map<string, SessionUser>();
  (sheetPosts || []).forEach(p => {
    if (p && p.author) {
      const authorAny = p.author as any;
      if (authorAny.uid || p.author.id) {
        const uid = String(authorAny.uid || p.author.id);
        const key = uid.toLowerCase();
        if (!userMap.has(key)) {
          const profile: any = {
            id: uid,
            uid: uid,
            username: (p.author.username || 'user').replace(/^@/, ''),
            name: p.author.name || 'User',
            avatar: p.author.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.author.username || 'user')}`,
            updatedAt: p.createdAtMs || Date.now()
          };
          if (authorAny.isAdmin !== undefined) profile.isAdmin = authorAny.isAdmin;
          if (authorAny.userGroup) profile.userGroup = authorAny.userGroup;
          if (authorAny.academicYear) profile.academicYear = authorAny.academicYear;
          if (authorAny.faculty) profile.faculty = authorAny.faculty;
          if (authorAny.badge) profile.badge = authorAny.badge;
          
          userMap.set(key, profile as SessionUser);
        }
      }
    }
  });
  return Array.from(userMap.values());
}

/**
 * Fetch profile from Google Sheets (supports both server proxy and direct fallback, handles # prefix)
 */
export async function fetchProfileFromGoogleSheets(uid: string): Promise<Partial<SessionUser> | null> {
  if (!uid) return null;
  const timestamp = Date.now();
  const candidates = [uid];
  if (uid.startsWith('#')) {
    candidates.push(uid.substring(1));
  } else {
    candidates.push('#' + uid);
  }

  for (const candidateUid of candidates) {
    const isAdmin = candidateUid.replace(/^#/, '').toUpperCase() === 'MED68001';
    try {
      const res = await fetch(`/api/sheets/profile/${encodeURIComponent(candidateUid)}?_t=${timestamp}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.status === 'success' && json.data && json.data.displayName) {
          const profile: Partial<SessionUser> = {
            id: json.data.uid || candidateUid,
            uid: json.data.uid || candidateUid,
            username: (json.data.username || 'user').replace(/^@/, ''),
            name: json.data.displayName || json.data.username || 'User',
            avatar: json.data.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(json.data.username || 'user')}`
          };
          if (isAdmin) {
            profile.isAdmin = true;
            profile.badge = '👑 Admin';
          }
          return profile;
        }
      }
    } catch (e) {
      console.warn('[SHEETS PROFILE FETCH] Proxy attempt failed for candidate:', candidateUid, e);
    }

    // Direct fallback
    try {
      const resDirect = await fetch(`${GOOGLE_SHEETS_ENDPOINT}?action=getProfile&uid=${encodeURIComponent(candidateUid)}&_t=${timestamp}`, {
        cache: 'no-store'
      });
      if (resDirect.ok) {
        const json = await resDirect.json();
        if (json.status === 'success' && json.data && json.data.displayName) {
          const profile: Partial<SessionUser> = {
            id: json.data.uid || candidateUid,
            uid: json.data.uid || candidateUid,
            username: (json.data.username || 'user').replace(/^@/, ''),
            name: json.data.displayName || json.data.username || 'User',
            avatar: json.data.profileImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(json.data.username || 'user')}`
          };
          if (isAdmin) {
            profile.isAdmin = true;
            profile.badge = '👑 Admin';
          }
          return profile;
        }
      }
    } catch (errDirect) {
      console.warn('[SHEETS PROFILE FETCH] Direct fetch attempt failed for candidate:', candidateUid, errDirect);
    }
  }

  return null;
}
