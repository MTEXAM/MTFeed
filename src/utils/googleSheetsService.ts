import { SessionUser, Post } from '../types';
import { systemHealthManager } from './systemHealthService';
import { setExplicitAvatar, getExplicitAvatar } from './auth';

export const GOOGLE_SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz1ZrKFZIHSnhlc6BQd_WvmOdHGa8ENQ6CuIu-MbPdWtgAtVj4WuzUgF6xtbtmFuPoBmQ/exec';

let lastProfileSyncKey = '';
let lastProfileSyncTime = 0;

/**
 * 1. Sync user profile to Google Sheets via server proxy / Apps Script
 * Payload format: { action: 'updateProfile', uid, username, displayName, profileImage, deleteOld: true, replaceOld: true }
 */
export async function syncProfileToGoogleSheets(user: Partial<SessionUser>): Promise<boolean> {
  if (!user) return false;
  const uid = user.uid || user.id;
  if (!uid) return false;

  const syncKey = `${uid}_${user.name}_${user.username}_${user.avatar}`;
  const now = Date.now();
  // Deduplicate rapid calls within 5 seconds for the exact same user data
  if (syncKey === lastProfileSyncKey && (now - lastProfileSyncTime < 5000)) {
    console.log('[SHEETS SYNC] Deduplicating profile sync call (already sent within 5s)');
    return true;
  }
  lastProfileSyncKey = syncKey;
  lastProfileSyncTime = now;

  const cleanUsername = user.username ? user.username.replace(/^@/, '') : '';
  const explicitAvatar = getExplicitAvatar(uid, cleanUsername, 'MED68001');

  let avatarToSend = user.avatar || '';
  if ((!avatarToSend || avatarToSend.includes('api.dicebear.com')) && explicitAvatar && !explicitAvatar.includes('api.dicebear.com')) {
    avatarToSend = explicitAvatar;
  }

  const payload = {
    action: 'updateProfile',
    uid: uid,
    username: cleanUsername,
    displayName: user.name || user.username || 'User',
    profileImage: avatarToSend,
    avatar: avatarToSend,
    image: avatarToSend,
    deleteOld: true,
    replaceOld: true,
    deletePrevious: true,
    cleanOldFiles: true,
    deleteOldDriveFiles: true,
    deleteSameNameFiles: true,
    deleteSameName: true,
    deleteOldImages: true,
    deleteFilesByName: true,
    removeDuplicates: true,
    fileName: `profile_${uid || cleanUsername}`,
    userKey: uid || cleanUsername,
    timestamp: now
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
      const data = await res.json().catch(() => ({}));
      const driveUrl = data?.result?.imageUrl || data?.result?.profileImage || data?.result?.data?.profileImage;
      if (driveUrl && typeof driveUrl === 'string' && driveUrl.startsWith('http')) {
        setExplicitAvatar(uid, driveUrl);
      }
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
 * Note: profileImage is omitted or sent only as URL to prevent Apps Script from creating duplicate profile files in Drive for every post
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

  const authorUid = (post.author as any)?.uid || post.author?.id || 'admin';
  const authorName = post.author?.name || post.author?.username || 'Bank';
  const authorUsername = (post.author?.username || '').replace(/^@/, '');
  const authorAvatar = post.author?.avatar && post.author.avatar.startsWith('http') ? post.author.avatar : '';

  const payload = {
    action: 'createPost',
    postId: post.id,
    uid: authorUid,
    displayName: authorName,
    username: authorUsername,
    author: authorName,
    profileImage: authorAvatar,
    content: post.content,
    image: post.image || '',
    pdf: post.pdf?.data || post.pdfUrl || post.pdf?.url || '',
    pdfName: post.pdfName || post.pdf?.name || 'เอกสารแนบ.pdf'
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

    const rawUid = row.uid || 'MED68001';
    const uid = rawUid.replace(/^#/, '');
    let displayName = row.displayName || row.author || '';
    if (!displayName || displayName === 'MED68001' || displayName === '#MED68001') {
      displayName = (uid === 'MED68001' || uid === 'BANK2026') ? 'Bank' : 'User';
    }
    let username = (row.username || displayName).replace(/^@/, '').toLowerCase().replace(/\s+/g, '_');
    if (username === 'med68001' || username === 'admin') {
      username = 'bank';
    }
    const avatar = row.profileImage || row.authorImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
    
    // Stable ID: prefer postId, or construct stable deterministic ID from timestamp/content
    const stableId = row.postId 
      ? String(row.postId)
      : (row.timestamp ? `sheet_time_${new Date(row.timestamp).getTime()}` : `sheet_row_${idx}`);

    let contentStr = typeof row.content === 'string' ? row.content : (row.content ? String(row.content) : '');
    let extractedImage = row.image || undefined;
    let extractedPdfUrl = row.pdfUrl || row.pdf || row.pdfLink || undefined;
    let extractedPdfName = row.pdfName || (extractedPdfUrl ? 'เอกสารประกอบการเรียน.pdf' : undefined);
    
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
      pdfUrl: extractedPdfUrl,
      pdfName: extractedPdfName,
      pdf: extractedPdfUrl ? { url: extractedPdfUrl, name: extractedPdfName || 'เอกสารแนบ.pdf' } : undefined,
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
          const rawName = p.author.name || '';
          const isPlaceholder = !rawName || rawName === 'MED68001' || rawName === '#MED68001' || rawName === 'User';
          const resolvedName = isPlaceholder ? (uid.toUpperCase() === 'MED68001' ? 'Bank' : 'User') : rawName;
          const resolvedUsername = (p.author.username || 'user').replace(/^@/, '');
          const cleanUsername = (resolvedUsername.toLowerCase() === 'med68001' || resolvedUsername.toLowerCase() === 'admin') ? 'bank' : resolvedUsername;

          const profile: any = {
            id: uid,
            uid: uid,
            username: cleanUsername,
            name: resolvedName,
            avatar: p.author.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}`,
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
          const profileImg = json.data.profileImage || '';
          const resolvedUsername = (json.data.username || 'user').replace(/^@/, '');
          const resolvedName = json.data.displayName || resolvedUsername || 'User';
          const explicitSaved = getExplicitAvatar(candidateUid, json.data.uid, resolvedUsername);
          
          let resolvedAvatar = profileImg;
          if ((!resolvedAvatar || resolvedAvatar.includes('api.dicebear.com')) && explicitSaved) {
            resolvedAvatar = explicitSaved;
          } else if (!resolvedAvatar) {
            resolvedAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedUsername)}`;
          }

          if (resolvedAvatar && !resolvedAvatar.includes('api.dicebear.com')) {
            setExplicitAvatar(candidateUid, resolvedAvatar);
            setExplicitAvatar(resolvedUsername, resolvedAvatar);
          }

          const profile: Partial<SessionUser> = {
            id: json.data.uid || candidateUid,
            uid: json.data.uid || candidateUid,
            username: resolvedUsername,
            name: resolvedName,
            avatar: resolvedAvatar
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
          const profileImg = json.data.profileImage || '';
          const resolvedUsername = (json.data.username || 'user').replace(/^@/, '');
          const resolvedName = json.data.displayName || resolvedUsername || 'User';
          const explicitSaved = getExplicitAvatar(candidateUid, json.data.uid, resolvedUsername);
          
          let resolvedAvatar = profileImg;
          if ((!resolvedAvatar || resolvedAvatar.includes('api.dicebear.com')) && explicitSaved) {
            resolvedAvatar = explicitSaved;
          } else if (!resolvedAvatar) {
            resolvedAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedUsername)}`;
          }

          if (resolvedAvatar && !resolvedAvatar.includes('api.dicebear.com')) {
            setExplicitAvatar(candidateUid, resolvedAvatar);
            setExplicitAvatar(resolvedUsername, resolvedAvatar);
          }

          const profile: Partial<SessionUser> = {
            id: json.data.uid || candidateUid,
            uid: json.data.uid || candidateUid,
            username: resolvedUsername,
            name: resolvedName,
            avatar: resolvedAvatar
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
