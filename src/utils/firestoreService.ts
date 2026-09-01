import { 
  collection, 
  doc, 
  getDoc,
  setDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Post, SessionUser, Comment, AppNotification } from '../types';
import { INITIAL_POSTS } from '../data';
import { DEFAULT_ACTIVE_USERS } from './auth';
import { syncProfileToGoogleSheets, syncPostToGoogleSheets, syncDeletePostToGoogleSheets } from './googleSheetsService';
import { systemHealthManager } from './systemHealthService';
import { formatRealTime } from './timeUtils';

const USERS_COLLECTION = 'users';
const POSTS_COLLECTION = 'posts';

// Seed initial default users to Firestore if collection is brand new
export async function seedInitialUsers(): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // 1. Seed DEFAULT_ACTIVE_USERS
    Object.values(DEFAULT_ACTIVE_USERS).forEach((user) => {
      const docId = (user.uid || user.username).toString();
      const userRef = doc(db, USERS_COLLECTION, docId);
      const userData: any = { ...user };
      Object.keys(userData).forEach(key => {
        if (userData[key] === undefined) delete userData[key];
      });
      batch.set(userRef, {
        ...userData,
        createdAtMs: Date.now()
      }, { merge: true });
    });

    // 2. Seed current logged in user if stored locally
    try {
      const localUserRaw = localStorage.getItem('mtfeed_user');
      if (localUserRaw) {
        const localUser = JSON.parse(localUserRaw);
        if (localUser && (localUser.uid || localUser.username)) {
          const docId = (localUser.uid || localUser.username).toString();
          const userRef = doc(db, USERS_COLLECTION, docId);
          const userData: any = { ...localUser };
          Object.keys(userData).forEach(key => {
            if (userData[key] === undefined) delete userData[key];
          });
          batch.set(userRef, {
            ...userData,
            createdAtMs: Date.now()
          }, { merge: true });
        }
      }
    } catch (e) {}

    await batch.commit();
    localStorage.setItem('mtfeed_users_seeded_v1', 'true');
  } catch (e) {
    console.error('Failed to seed initial users to Firestore:', e);
  }
}

// Listen to registered users in Firestore
export function subscribeToUsers(onUsersUpdate: (users: SessionUser[]) => void) {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    return onSnapshot(usersRef, (snapshot) => {
      if (snapshot.empty) {
        const hasSeeded = localStorage.getItem('mtfeed_users_seeded_v1');
        if (!hasSeeded) {
          localStorage.setItem('mtfeed_users_seeded_v1', 'true');
          seedInitialUsers();
          onUsersUpdate(Object.values(DEFAULT_ACTIVE_USERS));
          return;
        } else {
          onUsersUpdate([]);
          return;
        }
      }

      localStorage.setItem('mtfeed_users_seeded_v1', 'true');

      const usersList: SessionUser[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as SessionUser;
        if (data && (data.uid || data.username)) {
          usersList.push(data);
        }
      });
      systemHealthManager.reportFirestoreSuccess();
      onUsersUpdate(usersList);
    }, (error) => {
      console.error('Firestore users subscription error:', error);
      systemHealthManager.reportFirestoreDegraded('การเชื่อมต่อ Users Firestore ขัดข้อง');
    });
  } catch (e) {
    console.error('Failed to subscribe to users:', e);
    systemHealthManager.reportFirestoreDegraded('ไม่สามารถเริ่มต้น Users Subscription');
    return () => {};
  }
}

// Save or Update user in Firestore
export async function saveUserToFirestore(user: SessionUser): Promise<void> {
  if (!user || (!user.uid && !user.username)) return;
  
  // Layer 5: Schema Validation
  if (!user.username || typeof user.username !== 'string') {
    console.error('Invalid user data: missing or invalid username');
    return;
  }

  const docId = (user.uid || user.username).toString();
  try {
    const userData: any = { ...user };
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });

    // 1. Google Sheets Tier 1 Master Permanent Backup (Instant Fire)
    syncProfileToGoogleSheets(userData)
      .then(() => systemHealthManager.reportSheetsSuccess())
      .catch(err => {
        console.warn('Google Sheets user sync failed:', err);
        systemHealthManager.reportSheetsError();
      });

    // 2. SQLite Layer 2 Backup: Save User profile to local SQLite
    fetch('/api/backup/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userData, updatedAt: Date.now() })
    })
      .then(() => systemHealthManager.reportBackupSuccess())
      .catch(err => console.warn('SQLite user backup sync failed:', err));

    // 3. Firestore Realtime Sync
    const userRef = doc(db, USERS_COLLECTION, docId);
    
    // Layer 6: Create Snapshot before update
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const backupRef = doc(db, 'profile_backups', docId, 'snapshots', Date.now().toString());
      await setDoc(backupRef, docSnap.data()).catch(() => {});
    }

    await setDoc(userRef, {
      ...userData,
      updatedAt: Date.now()
    }, { merge: true });

    systemHealthManager.reportFirestoreSuccess();
  } catch (e) {
    console.error('Error saving user to Firestore (enqueued for auto-retry):', e);
    systemHealthManager.reportFirestoreDegraded('เกิดปัญหาในการบันทึก User ไปยัง Firestore');
    systemHealthManager.enqueueAction('SAVE_USER', user);
  }
}

// Get user from Firestore
export async function getUserFromFirestore(uidOrUsername: string): Promise<SessionUser | null> {
  if (!uidOrUsername) return null;
  try {
    const docId = uidOrUsername.toString();
    const userRef = doc(db, USERS_COLLECTION, docId);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      return docSnap.data() as SessionUser;
    }
  } catch (e) {
    console.error('Error fetching user from Firestore:', e);
  }
  return null;
}

// Delete single user from Firestore
export async function deleteUserFromFirestore(uidOrUsername: string): Promise<boolean> {
  const clean = uidOrUsername.trim().toLowerCase().replace(/^@/, '').replace(/^#/, '');
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    const deletePromises: Promise<void>[] = [];
    let found = false;

    snapshot.forEach((docSnap) => {
      const u = docSnap.data() as SessionUser;
      const docId = docSnap.id.toLowerCase();
      if (
        docId === clean ||
        (u.uid && u.uid.toLowerCase().replace(/^#/, '') === clean) ||
        (u.username && u.username.toLowerCase().replace(/^@/, '') === clean) ||
        (u.id && String(u.id).toLowerCase() === clean)
      ) {
        deletePromises.push(deleteDoc(doc(db, USERS_COLLECTION, docSnap.id)));
        found = true;
      }
    });

    if (found) {
      await Promise.all(deletePromises);
      // SQLite Layer 2 Backup: Delete user backup from local SQLite
      fetch(`/api/backup/users/${uidOrUsername}`, { method: 'DELETE' })
        .catch(err => console.warn('SQLite user delete sync failed:', err));
    }
    return found;
  } catch (e) {
    console.error('Error deleting user from Firestore:', e);
    return false;
  }
}

// Clear all users from Firestore (admin feature)
export async function clearAllUsersFromFirestore(keepUser?: SessionUser): Promise<void> {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    const snapshot = await getDocs(usersRef);
    const deletePromises: Promise<void>[] = [];

    snapshot.forEach((docSnap) => {
      const u = docSnap.data() as SessionUser;
      const docId = docSnap.id;
      
      const isKeepDoc = keepUser && (
        docId.toLowerCase() === (keepUser.uid || '').toLowerCase() ||
        docId.toLowerCase() === (keepUser.username || '').toLowerCase() ||
        (u.uid && u.uid.toLowerCase() === (keepUser.uid || '').toLowerCase()) ||
        (u.username && u.username.toLowerCase() === (keepUser.username || '').toLowerCase())
      );

      if (!isKeepDoc) {
        deletePromises.push(deleteDoc(doc(db, USERS_COLLECTION, docId)));
      }
    });

    await Promise.all(deletePromises);

    if (keepUser) {
      await saveUserToFirestore(keepUser);
    }
  } catch (e) {
    console.error('Error clearing all users from Firestore:', e);
  }
}

// Recursive sanitizer to remove any undefined fields before writing to Firestore
function sanitizeForFirestore(val: any): any {
  if (val === null || val === undefined) return null;
  if (Array.isArray(val)) {
    return val.map(sanitizeForFirestore).filter(v => v !== undefined);
  }
  if (typeof val === 'object' && !(val instanceof Date)) {
    const cleaned: any = {};
    for (const key of Object.keys(val)) {
      const v = val[key];
      if (v !== undefined) {
        cleaned[key] = sanitizeForFirestore(v);
      }
    }
    return cleaned;
  }
  return val;
}

// Local and Cloud tracking of deleted post IDs
const DELETED_POSTS_KEY = 'mtfeed_deleted_post_ids';

export function getDeletedPostIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const raw = localStorage.getItem(DELETED_POSTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(id => {
          if (id) ids.add(String(id));
        });
      }
    }
  } catch (e) {}
  return ids;
}

export function markPostAsDeletedLocally(postId: string) {
  if (!postId) return;
  try {
    const ids = getDeletedPostIds();
    ids.add(postId);
    localStorage.setItem(DELETED_POSTS_KEY, JSON.stringify(Array.from(ids)));
    
    // Also remove from local cached posts
    const localPostsRaw = localStorage.getItem('mtfeed_posts');
    if (localPostsRaw) {
      const parsed = JSON.parse(localPostsRaw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((p: any) => p && p.id !== postId);
        localStorage.setItem('mtfeed_posts', JSON.stringify(filtered));
      }
    }
  } catch (e) {}
}

export function mergePostsLists(incomingPosts: Post[], existingPosts: Post[]): Post[] {
  const deletedIds = getDeletedPostIds();
  const map = new Map<string, Post>();
  const contentMap = new Map<string, string>(); // Maps contentKey -> authoritative post ID

  // Helper to generate a standardized unique key for a post's content and author
  const getContentKey = (p: Post) => {
    const rawAuthor = (p.author as any)?.uid || p.author?.id || p.author?.username || 'unknown';
    const cleanAuthor = String(rawAuthor).trim().toLowerCase().replace(/^[@#]/, '');
    const cleanContent = (p.content || '').trim().replace(/\s+/g, ' ').slice(0, 120).toLowerCase();
    return `${cleanAuthor}_${cleanContent}`;
  };

  // 1. Add cloud/incoming posts first (authoritative)
  if (Array.isArray(incomingPosts)) {
    incomingPosts.forEach(p => {
      if (p && p.id && !deletedIds.has(p.id)) {
        map.set(p.id, p);
        contentMap.set(getContentKey(p), p.id);
      }
    });
  }

  // 2. Preserve any existing local posts that are NOT in deleted list
  if (Array.isArray(existingPosts)) {
    existingPosts.forEach(p => {
      if (p && p.id && !deletedIds.has(p.id)) {
        const cKey = getContentKey(p);
        
        // Check if this post is a duplicate of a cloud post but under a different ID
        const isDuplicateWithDifferentId = contentMap.has(cKey) && contentMap.get(cKey) !== p.id;
        const targetId = isDuplicateWithDifferentId ? contentMap.get(cKey)! : p.id;

        if (!map.has(targetId)) {
          // Keep local post so user content is preserved
          map.set(targetId, p);
          contentMap.set(cKey, targetId);
        } else {
          // Merge comments and interactions cleanly
          const cloudPost = map.get(targetId)!;
          const mergedCommentsMap = new Map<string, Comment>();
          (cloudPost.comments || []).forEach(c => c && c.id && mergedCommentsMap.set(c.id, c));
          (p.comments || []).forEach(c => c && c.id && mergedCommentsMap.set(c.id, c));
          const mergedComments = Array.from(mergedCommentsMap.values());
          mergedComments.sort((a, b) => ((a as any).createdAtMs || 0) - ((b as any).createdAtMs || 0));

          // Merge active interaction lists
          const mergedLikedBy = Array.from(new Set([
            ...(cloudPost.likedBy || []),
            ...(p.likedBy || [])
          ]));
          const mergedBookmarkedBy = Array.from(new Set([
            ...(cloudPost.bookmarkedBy || []),
            ...(p.bookmarkedBy || [])
          ]));
          const mergedRepostedBy = Array.from(new Set([
            ...(cloudPost.repostedBy || []),
            ...(p.repostedBy || [])
          ]));

          const finalLikes = (cloudPost.likedBy && cloudPost.likedBy.length > 0) || (p.likedBy && p.likedBy.length > 0)
            ? mergedLikedBy.length 
            : (cloudPost.stats?.likes || 0);
          const finalBookmarks = (cloudPost.bookmarkedBy && cloudPost.bookmarkedBy.length > 0) || (p.bookmarkedBy && p.bookmarkedBy.length > 0)
            ? mergedBookmarkedBy.length 
            : (cloudPost.stats?.bookmarks || 0);
          const finalReposts = (cloudPost.repostedBy && cloudPost.repostedBy.length > 0) || (p.repostedBy && p.repostedBy.length > 0)
            ? mergedRepostedBy.length 
            : (cloudPost.stats?.reposts || 0);

          map.set(targetId, {
            ...cloudPost,
            image: (p.image && p.image.length > 10) ? p.image : (cloudPost.image || ''),
            pdf: (p.pdf && p.pdf.dataUrl) ? p.pdf : (cloudPost.pdf || undefined),
            comments: mergedComments,
            likedBy: mergedLikedBy,
            bookmarkedBy: mergedBookmarkedBy,
            repostedBy: mergedRepostedBy,
            votedBy: cloudPost.votedBy || p.votedBy || [],
            stats: {
              ...cloudPost.stats,
              likes: finalLikes,
              replies: Math.max(cloudPost.stats?.replies || 0, p.stats?.replies || 0, mergedComments.length),
              reposts: finalReposts,
              bookmarks: finalBookmarks
            }
          });
        }
      }
    });
  }

  const result = Array.from(map.values());
  result.sort((a, b) => {
    const timeA = (a as any).createdAtMs || 0;
    const timeB = (b as any).createdAtMs || 0;
    return timeB - timeA;
  });

  // Fast Equality Check: If result is identical to existingPosts, return existingPosts to avoid React re-render flicker
  if (Array.isArray(existingPosts) && existingPosts.length === result.length) {
    let isIdentical = true;
    for (let i = 0; i < result.length; i++) {
      const r = result[i];
      const e = existingPosts[i];
      if (
        !e ||
        r.id !== e.id ||
        r.content !== e.content ||
        r.stats?.likes !== e.stats?.likes ||
        r.stats?.replies !== e.stats?.replies ||
        r.stats?.reposts !== e.stats?.reposts ||
        r.stats?.bookmarks !== e.stats?.bookmarks ||
        (r.comments?.length || 0) !== (e.comments?.length || 0) ||
        r.isReported !== e.isReported
      ) {
        isIdentical = false;
        break;
      }
    }
    if (isIdentical) {
      return existingPosts;
    }
  }

  return result;
}

// Listen to community posts in Firestore
export function subscribeToPosts(onPostsUpdate: (posts: Post[]) => void) {
  try {
    const postsRef = collection(db, POSTS_COLLECTION);
    const metaRef = doc(db, 'system_config', 'posts_seeded');
    const deletedDocRef = doc(db, 'system_config', 'deleted_posts');

    // 1. Subscribe to cloud deleted posts list
    onSnapshot(deletedDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.ids)) {
          const currentLocal = getDeletedPostIds();
          let changed = false;
          data.ids.forEach((id: string) => {
            if (id && !currentLocal.has(id)) {
              currentLocal.add(id);
              changed = true;
            }
          });
          if (changed) {
            try {
              localStorage.setItem(DELETED_POSTS_KEY, JSON.stringify(Array.from(currentLocal)));
            } catch (e) {}
          }
        }
      }
    }, (err) => {
      console.warn('Deleted posts sync error:', err);
    });

    // 2. Initial seed check - ONLY once for a brand new empty database
    getDoc(metaRef).then(async (metaSnap) => {
      if (!metaSnap.exists()) {
        try {
          const existingSnap = await getDocs(postsRef);
          if (existingSnap.empty) {
            const deleted = getDeletedPostIds();
            // If user has already deleted posts, DO NOT seed example posts
            if (deleted.size === 0) {
              await seedInitialPosts();
            } else {
              await setDoc(metaRef, { seeded: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
            }
          } else {
            await setDoc(metaRef, { seeded: true, updatedAt: Date.now() }, { merge: true }).catch(() => {});
          }
        } catch (err) {
          console.warn('Seed status query failed:', err);
        }
      }
    }).catch(e => {
      console.warn('Seed status check skipped:', e);
    });

    // 3. Listen to live posts snapshot
    return onSnapshot(postsRef, (snapshot) => {
      const deletedIds = getDeletedPostIds();
      if (snapshot.empty) {
        onPostsUpdate([]);
        return;
      }

      const postsList: Post[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Post;
        if (data && data.id && data.content && !deletedIds.has(data.id)) {
          postsList.push(data);
        }
      });

      // Sort posts by newest
      postsList.sort((a, b) => {
        const timeA = (a as any).createdAtMs || 0;
        const timeB = (b as any).createdAtMs || 0;
        return timeB - timeA;
      });

      systemHealthManager.reportFirestoreSuccess();
      onPostsUpdate(postsList);
    }, (error) => {
      console.error('Firestore posts subscription error:', error);
      systemHealthManager.reportFirestoreDegraded('การเชื่อมต่อ Posts Firestore ขัดข้อง');
    });
  } catch (e) {
    console.error('Failed to subscribe to posts:', e);
    systemHealthManager.reportFirestoreDegraded('ไม่สามารถเริ่มต้น Posts Subscription');
    return () => {};
  }
}

// Seed initial posts to Firestore (only called on brand new system initialization)
async function seedInitialPosts() {
  try {
    const deletedIds = getDeletedPostIds();
    const batch = writeBatch(db);
    let count = 0;
    INITIAL_POSTS.forEach((post, index) => {
      if (!deletedIds.has(post.id)) {
        count++;
        const postRef = doc(db, POSTS_COLLECTION, post.id);
        const postData = sanitizeForFirestore(post);
        const createdAtMs = post.createdAtMs || (Date.now() - (index + 1) * 3600000);
        batch.set(postRef, {
          ...postData,
          createdAtMs
        });
      }
    });

    const metaRef = doc(db, 'system_config', 'posts_seeded');
    batch.set(metaRef, { seeded: true, updatedAt: Date.now() });

    if (count > 0) {
      await batch.commit();
    } else {
      await setDoc(metaRef, { seeded: true, updatedAt: Date.now() }, { merge: true });
    }
    systemHealthManager.reportFirestoreSuccess();
  } catch (e) {
    console.error('Failed to seed initial posts:', e);
  }
}

// Save or Update post in Firestore
export async function savePostToFirestore(post: Post): Promise<void> {
  if (!post || !post.id) return;
  const deletedIds = getDeletedPostIds();
  if (deletedIds.has(post.id)) return; // Don't save deleted post

  const fullPostWithTime = {
    ...post,
    createdAtMs: (post as any).createdAtMs || Date.now()
  };

  // 1. SQLite Layer 2 Backup: Save Post to local SQLite
  fetch('/api/backup/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([fullPostWithTime])
  })
    .then(() => systemHealthManager.reportBackupSuccess())
    .catch(err => console.warn('SQLite post backup sync failed:', err));

  // 2. Firestore Realtime Sync
  try {
    const postData = sanitizeForFirestore(fullPostWithTime);
    const postRef = doc(db, POSTS_COLLECTION, post.id);
    await setDoc(postRef, postData, { merge: true });
    systemHealthManager.reportFirestoreSuccess();
  } catch (e) {
    console.warn('Error saving post to Firestore (enqueued for auto-retry):', e);
    systemHealthManager.reportFirestoreDegraded('เกิดปัญหาในการบันทึก Post ไปยัง Firestore');
    systemHealthManager.enqueueAction('SAVE_POST', fullPostWithTime);
  }
}

// Save all posts list to Firestore
export async function syncPostsToFirestore(posts: Post[]): Promise<void> {
  try {
    const deletedIds = getDeletedPostIds();
    const batch = writeBatch(db);
    const backupList: Post[] = [];

    posts.forEach((post) => {
      if (post && post.id && !deletedIds.has(post.id)) {
        const postRef = doc(db, POSTS_COLLECTION, post.id);
        const postData = sanitizeForFirestore(post);
        const fullPostWithTime = {
          ...postData,
          createdAtMs: (post as any).createdAtMs || Date.now()
        };
        batch.set(postRef, fullPostWithTime, { merge: true });
        backupList.push(fullPostWithTime);
      }
    });
    const metaRef = doc(db, 'system_config', 'posts_seeded');
    batch.set(metaRef, { seeded: true, updatedAt: Date.now() });
    await batch.commit();

    // SQLite Layer 2 Backup: Save Posts in bulk to local SQLite
    if (backupList.length > 0) {
      fetch('/api/backup/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupList)
      })
        .then(() => systemHealthManager.reportBackupSuccess())
        .catch(err => console.warn('SQLite bulk posts backup sync failed:', err));
    }
    systemHealthManager.reportFirestoreSuccess();
  } catch (e) {
    console.error('Error syncing posts to Firestore:', e);
    systemHealthManager.reportFirestoreDegraded('เกิดปัญหาในการซิงก์ Posts ไปยัง Firestore');
    systemHealthManager.enqueueAction('SYNC_POSTS', posts);
  }
}

// Delete post from Firestore permanently
export async function deletePostFromFirestore(postId: string, content?: string, uid?: string): Promise<void> {
  if (!postId) return;
  markPostAsDeletedLocally(postId);

  // 1. Google Sheets Layer 1 Permanent: Delete post in Google Sheet
  syncDeletePostToGoogleSheets(postId, content, uid)
    .then(() => systemHealthManager.reportSheetsSuccess())
    .catch(err => {
      console.warn('Google Sheets delete sync failed:', err);
      systemHealthManager.reportSheetsError();
    });

  try {
    // 2. Delete document from posts collection
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await deleteDoc(postRef).catch(() => {});

    // SQLite Layer 2 Backup: Delete post from local SQLite
    fetch(`/api/backup/posts/${postId}`, { method: 'DELETE' })
      .then(() => systemHealthManager.reportBackupSuccess())
      .catch(err => console.warn('SQLite post delete sync failed:', err));

    // 3. Persist deleted post ID in system_config/deleted_posts
    const deletedDocRef = doc(db, 'system_config', 'deleted_posts');
    const snap = await getDoc(deletedDocRef).catch(() => null);
    const existingCloudIds: string[] = snap && snap.exists() ? (snap.data().ids || []) : [];
    const combinedIds = Array.from(new Set([...existingCloudIds, ...Array.from(getDeletedPostIds()), postId]));

    await setDoc(deletedDocRef, { ids: combinedIds, updatedAt: Date.now() }, { merge: true }).catch(() => {});
    systemHealthManager.reportFirestoreSuccess();
  } catch (e) {
    console.error('Error deleting post from Firestore:', e);
    systemHealthManager.reportFirestoreDegraded('เกิดปัญหาในการลบ Post บน Firestore');
    systemHealthManager.enqueueAction('DELETE_POST', { postId, content, uid });
  }
}

// SQLite Backup Layer Restoration APIs
export async function getBackupPostsFromSQLite(): Promise<Post[]> {
  try {
    const res = await fetch('/api/backup/posts');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('Failed to load posts from SQLite backup:', e);
  }
  return [];
}

export async function getBackupUsersFromSQLite(): Promise<SessionUser[]> {
  try {
    const res = await fetch('/api/backup/users');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.error('Failed to load users from SQLite backup:', e);
  }
  return [];
}

// Background Back-Sync Throttling: Restore data back to Firestore in chunks with a rate-limit delay
export async function restoreBackupsToFirestore(postsToSync: Post[], usersToSync: SessionUser[]): Promise<void> {
  const CHUNK_SIZE = 5; // Process 5 records per batch
  const DELAY_MS = 1000; // 1-second interval delay to respect Firestore rate limits and reduce Peak Write Ops
  
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 1. Throttled Restoration of Users
  if (usersToSync && usersToSync.length > 0) {
    console.log(`[SELF-HEALING] Beginning throttled back-sync for ${usersToSync.length} users...`);
    for (let i = 0; i < usersToSync.length; i += CHUNK_SIZE) {
      const chunk = usersToSync.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      
      chunk.forEach(u => {
        const uid = u.uid || u.username || u.id;
        if (uid) {
          const userRef = doc(db, USERS_COLLECTION, uid);
          batch.set(userRef, u, { merge: true });
        }
      });
      
      await batch.commit().catch(err => {
        console.error('[SELF-HEALING] Error restoring user batch:', err);
      });
      
      console.log(`[SELF-HEALING] Restored user batch ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(usersToSync.length / CHUNK_SIZE)}`);
      await sleep(DELAY_MS);
    }
  }

  // 2. Throttled Restoration of Posts
  if (postsToSync && postsToSync.length > 0) {
    const deletedIds = getDeletedPostIds();
    const activePosts = postsToSync.filter(p => p && p.id && !deletedIds.has(p.id));
    
    if (activePosts.length > 0) {
      console.log(`[SELF-HEALING] Beginning throttled back-sync for ${activePosts.length} posts...`);
      for (let i = 0; i < activePosts.length; i += CHUNK_SIZE) {
        const chunk = activePosts.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        
        chunk.forEach(post => {
          const postRef = doc(db, POSTS_COLLECTION, post.id);
          const postData = sanitizeForFirestore(post);
          batch.set(postRef, {
            ...postData,
            createdAtMs: (post as any).createdAtMs || Date.now()
          }, { merge: true });
        });
        
        await batch.commit().catch(err => {
          console.error('[SELF-HEALING] Error restoring post batch:', err);
        });
        
        console.log(`[SELF-HEALING] Restored post batch ${Math.floor(i / CHUNK_SIZE) + 1} / ${Math.ceil(activePosts.length / CHUNK_SIZE)}`);
        await sleep(DELAY_MS);
      }
    }
  }

  console.log('[SELF-HEALING] Throttled backup restoration finished successfully!');
}

// -------------------------------------------------------------
// System Broadcasts & Notifications Subscriptions
// -------------------------------------------------------------
const NOTIFICATIONS_COLLECTION = 'notifications';

export async function sendSystemBroadcastToFirestore(broadcast: {
  id?: string;
  title: string;
  description: string;
  severity?: 'info' | 'warning' | 'alert' | 'success';
  senderType?: 'admin' | 'system';
  targetTag?: string;
  createdAt?: string;
  createdAtMs?: number;
  read?: boolean;
  [key: string]: any;
}): Promise<AppNotification> {
  const nowMs = broadcast.createdAtMs || Date.now();
  const id = broadcast.id || `sys_broadcast_${nowMs}_${Math.random().toString(36).substring(2, 7)}`;
  const notifData: AppNotification = {
    id,
    type: 'system',
    title: broadcast.title,
    description: broadcast.description,
    createdAt: broadcast.createdAt || formatRealTime(nowMs),
    createdAtMs: nowMs,
    read: false,
    isBroadcast: true,
    senderType: broadcast.senderType || 'admin',
    severity: broadcast.severity || 'info',
    targetTag: broadcast.targetTag
  };

  // 1. Dual-Write to SQLite Local Server Backup
  fetch('/api/backup/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([notifData])
  })
    .then(() => systemHealthManager.reportBackupSuccess())
    .catch(err => console.warn('SQLite notification backup sync failed:', err));

  // 2. Write to Cloud Firestore
  try {
    const notifRef = doc(db, NOTIFICATIONS_COLLECTION, notifData.id);
    await setDoc(notifRef, notifData, { merge: true });
    systemHealthManager.reportFirestoreSuccess();
  } catch (e) {
    console.error('Error sending system broadcast to Firestore:', e);
    systemHealthManager.reportFirestoreDegraded('ส่งประกาศไปยัง Firestore ไม่สำเร็จ');
    systemHealthManager.enqueueAction('SEND_BROADCAST', notifData);
  }

  return notifData;
}

export function subscribeToSystemNotifications(onNotificationsUpdate: (notifications: AppNotification[]) => void) {
  try {
    const notifsRef = collection(db, NOTIFICATIONS_COLLECTION);
    return onSnapshot(notifsRef, (snapshot) => {
      const list: AppNotification[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AppNotification;
        if (data && data.id) {
          list.push(data);
        }
      });
      // Sort by newest first
      list.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
      systemHealthManager.reportFirestoreSuccess();
      onNotificationsUpdate(list);
    }, (error) => {
      console.error('Firestore notifications subscription error:', error);
      systemHealthManager.reportFirestoreDegraded('การเชื่อมต่อ Notifications Firestore ขัดข้อง');
    });
  } catch (e) {
    console.error('Failed to subscribe to notifications:', e);
    return () => {};
  }
}

