import { SessionUser, Post } from '../types';
import { systemHealthManager } from './systemHealthService';
import { setExplicitAvatar, getExplicitAvatar } from './auth';

export const GOOGLE_SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz1ZrKFZIHSnhlc6BQd_WvmOdHGa8ENQ6CuIu-MbPdWtgAtVj4WuzUgF6xtbtmFuPoBmQ/exec';

let lastProfileSyncKey = '';
let lastProfileSyncTime = 0;

/**
 * Extract Google Drive file ID from a Drive link or lh3.googleusercontent.com link
 */
export function extractDriveFileId(url: string | undefined | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match1 && match1[1]) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2 && match2[1]) return match2[1];
  return null;
}

export interface ProfileSyncResult {
  success: boolean;
  driveUrl?: string;
}

/**
 * 1. Sync user profile to Google Sheets via server proxy / Apps Script
 * Payload format: { action: 'updateProfile', uid, username, displayName, profileImage, oldFileId, deleteOld: true, replaceOld: true }
 */
export async function syncProfileToGoogleSheets(
  user: Partial<SessionUser>,
  options?: { oldAvatar?: string; isExplicitSave?: boolean }
): Promise<ProfileSyncResult> {
  if (!user) return { success: false };
  const uid = user.uid || user.id;
  if (!uid) return { success: false };

  const cleanUsername = user.username ? user.username.replace(/^@/, '') : '';
  const explicitAvatar = getExplicitAvatar(uid, cleanUsername, 'MED68001');

  let avatarToSend = user.avatar || '';
  if (!options?.isExplicitSave && (!avatarToSend || avatarToSend.includes('api.dicebear.com')) && explicitAvatar && !explicitAvatar.includes('api.dicebear.com')) {
    avatarToSend = explicitAvatar;
  }

  // CRITICAL ANTI-DUPLICATE GUARD:
  // If avatarToSend is Base64 (data:image/...) AND this is NOT an explicit user save action (e.g. background sync or page reload),
  // DO NOT send the Base64 data to Apps Script! Apps Script creates a new file in Drive on every Base64 payload.
  if (avatarToSend.startsWith('data:image/') && !options?.isExplicitSave) {
    if (explicitAvatar && explicitAvatar.startsWith('http')) {
      avatarToSend = explicitAvatar;
    } else {
      // Don't send base64 during background auto-syncs or on page loads
      avatarToSend = '';
    }
  }

  const syncKey = `${uid}_${user.name}_${user.username}_${avatarToSend}`;
  const now = Date.now();
  // Deduplicate rapid calls within 5 seconds for the exact same user data
  if (syncKey === lastProfileSyncKey && (now - lastProfileSyncTime < 5000)) {
    console.log('[SHEETS SYNC] Deduplicating profile sync call (already sent within 5s)');
    return { success: true };
  }
  lastProfileSyncKey = syncKey;
  lastProfileSyncTime = now;

  const oldFileId = extractDriveFileId(options?.oldAvatar || explicitAvatar || user.avatar);

  const payload = {
    action: 'updateProfile',
    uid: uid,
    username: cleanUsername,
    displayName: user.name || user.username || 'User',
    profileImage: avatarToSend,
    avatar: avatarToSend,
    image: avatarToSend,
    oldFileId: oldFileId || '',
    oldProfileImage: options?.oldAvatar || '',
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
        setExplicitAvatar(cleanUsername, driveUrl);
        return { success: true, driveUrl };
      }
      return { success: true };
    }
  } catch (err) {
    console.warn('[SHEETS SYNC] Server proxy failed, trying direct Apps Script fetch...', err);
  }

  try {
    // 2. Fallback to direct client-side fetch
    const directRes = await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload)
    });
    const directJson = await directRes.json().catch(() => ({}));
    const driveUrl = directJson?.profileImage || directJson?.imageUrl;
    if (driveUrl && typeof driveUrl === 'string' && driveUrl.startsWith('http')) {
      setExplicitAvatar(uid, driveUrl);
      setExplicitAvatar(cleanUsername, driveUrl);
      return { success: true, driveUrl };
    }
    console.log('[SHEETS SYNC] Profile sent directly to Google Sheets Apps Script');
    return { success: true };
  } catch (err) {
    console.error('[SHEETS SYNC ERROR] Direct sync to Google Sheets failed:', err);
    return { success: false };
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
    // Due to legacy Google Apps Script, keys might be PascalCase or camelCase
    const timestampVal = row.timestamp || row.Timestamp || row.createdAt || row.CreatedAt;
    
    // In old schema, Timestamp column (index 6) might contain imageUrl instead of timestamp
    // If timestampVal is a URL, it's an image
    let rawTime = Date.now() - idx * 60000;
    let fallbackImageUrl = undefined;
    
    if (timestampVal && typeof timestampVal === 'string' && timestampVal.startsWith('http')) {
      fallbackImageUrl = timestampVal;
    } else if (timestampVal) {
      rawTime = new Date(timestampVal).getTime();
    }
    
    const dateObj = new Date(rawTime);
    const dateFormatted = !isNaN(dateObj.getTime())
      ? dateObj.toLocaleDateString('th-TH', { month: 'short', day: 'numeric' }) + ' • ' + dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      : 'เมื่อสักครู่';

    const rawUid = row.uid || row.UID || row.userId || row.UserID || 'MED68001';
    const uid = String(rawUid).replace(/^#/, '');
    
    // Note: old script put displayName in Username column and username in DisplayName column
    let displayName = row.displayName || row.DisplayName || row.author || row.Username || row.username || '';
    if (!displayName || displayName === 'MED68001' || displayName === '#MED68001') {
      displayName = (uid === 'MED68001' || uid === 'BANK2026') ? 'Bank' : 'User';
    }
    let username = (row.username || row.Username || row.DisplayName || row.displayName || displayName).replace(/^@/, '').toLowerCase().replace(/\s+/g, '_');
    if (username === 'med68001' || username === 'admin') {
      username = 'bank';
    }
    const avatar = row.profileImage || row.ProfileImage || row.authorImage || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(username)}`;
    
    // Stable ID: prefer postId, or construct stable deterministic ID from timestamp/content
    const postIdVal = row.postId || row.PostID || row.id || row.ID;
    const stableId = postIdVal 
      ? String(postIdVal)
      : (timestampVal && !fallbackImageUrl ? `sheet_time_${new Date(timestampVal).getTime()}` : `sheet_row_${idx}`);

    let contentStr = row.content || row.Content || '';
    contentStr = typeof contentStr === 'string' ? contentStr : String(contentStr);
    
    let extractedImage = row.image || row.Image || row.imageUrl || row.ImageUrl || fallbackImageUrl || undefined;
    let extractedPdfUrl = row.pdfUrl || row.PdfUrl || row.pdf || row.Pdf || row.pdfLink || undefined;
    let extractedPdfName = row.pdfName || row.PdfName || (extractedPdfUrl ? 'เอกสารประกอบการเรียน.pdf' : undefined);
    
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
  }).filter((post: Post) => {
    // Filter out completely empty posts (usually caused by deletion remnants or schema mismatches)
    const hasContent = typeof post.content === 'string' && post.content.trim().length > 0 && post.content !== 'undefined' && post.content !== 'null';
    const hasImage = typeof post.image === 'string' && post.image.trim().length > 0 && post.image !== 'undefined';
    const hasPdf = typeof post.pdfUrl === 'string' && post.pdfUrl.trim().length > 0 && post.pdfUrl !== 'undefined';
    const hasPoll = post.poll && Array.isArray(post.poll.options) && post.poll.options.length > 0;
    return hasContent || hasImage || hasPdf || hasPoll;
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
          if (explicitSaved && !explicitSaved.includes('api.dicebear.com')) {
            // Local custom avatar always takes precedence over potentially stale remote sheet cache
            resolvedAvatar = explicitSaved;
          } else if (!resolvedAvatar || resolvedAvatar.includes('api.dicebear.com')) {
            resolvedAvatar = explicitSaved || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedUsername)}`;
          }

          if (!explicitSaved && resolvedAvatar && !resolvedAvatar.includes('api.dicebear.com')) {
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
          if (explicitSaved && !explicitSaved.includes('api.dicebear.com')) {
            resolvedAvatar = explicitSaved;
          } else if (!resolvedAvatar || resolvedAvatar.includes('api.dicebear.com')) {
            resolvedAvatar = explicitSaved || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(resolvedUsername)}`;
          }

          if (!explicitSaved && resolvedAvatar && !resolvedAvatar.includes('api.dicebear.com')) {
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

/**
 * Delete a user from Google Sheets and remove their image files in Google Drive
 */
export async function deleteUserFromGoogleSheets(uidOrUsername: string): Promise<boolean> {
  if (!uidOrUsername) return false;
  const clean = uidOrUsername.replace(/^@/, '');
  try {
    const res = await fetch('/api/sheets/deleteUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: clean, username: clean })
    });
    if (res.ok) return true;
  } catch (e) {
    console.warn('[SHEETS DELETE USER PROXY ERROR]', e);
  }

  // Fallback direct
  try {
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'deleteUser', uid: clean, username: clean })
    });
    return true;
  } catch (e) {
    console.error('[SHEETS DELETE USER DIRECT ERROR]', e);
    return false;
  }
}

/**
 * Reset Google Sheets (Feed & Users) and Google Drive folders (MTFeed_Profiles & MTFeed_Uploads)
 */
export async function resetGoogleSheetsAndDrive(): Promise<boolean> {
  try {
    const res = await fetch('/api/sheets/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      console.log('[SHEETS RESET] Google Sheets and Google Drive reset successfully via proxy');
      return true;
    }
  } catch (e) {
    console.warn('[SHEETS RESET PROXY ERROR]', e);
  }

  // Fallback direct
  try {
    await fetch(GOOGLE_SHEETS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'resetData' })
    });
    console.log('[SHEETS RESET] Google Sheets and Google Drive reset successfully via direct fetch');
    return true;
  } catch (e) {
    console.error('[SHEETS RESET DIRECT ERROR]', e);
    return false;
  }
}

