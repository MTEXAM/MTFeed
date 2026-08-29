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
import { Post, SessionUser } from '../types';
import { INITIAL_POSTS } from '../data';
import { DEFAULT_ACTIVE_USERS } from './auth';

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
      onUsersUpdate(usersList);
    }, (error) => {
      console.error('Firestore users subscription error:', error);
    });
  } catch (e) {
    console.error('Failed to subscribe to users:', e);
    return () => {};
  }
}

// Save or Update user in Firestore
export async function saveUserToFirestore(user: SessionUser): Promise<void> {
  if (!user || (!user.uid && !user.username)) return;
  const docId = (user.uid || user.username).toString();
  try {
    const userData: any = { ...user };
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });
    const userRef = doc(db, USERS_COLLECTION, docId);
    await setDoc(userRef, {
      ...userData,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) {
    console.error('Error saving user to Firestore:', e);
  }
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

// Local and Cloud tracking of deleted post IDs
const DELETED_POSTS_KEY = 'mtfeed_deleted_post_ids';

export function getDeletedPostIds(): Set<string> {
  const ids = new Set<string>();
  try {
    const raw = localStorage.getItem(DELETED_POSTS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(id => ids.add(String(id)));
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
  } catch (e) {}
}

export function mergePostsLists(incomingPosts: Post[], existingPosts: Post[]): Post[] {
  const deletedIds = getDeletedPostIds();
  const map = new Map<string, Post>();

  // 1. Add incoming posts
  if (Array.isArray(incomingPosts)) {
    incomingPosts.forEach(p => {
      if (p && p.id && !deletedIds.has(p.id)) {
        map.set(p.id, p);
      }
    });
  }

  // 2. Preserve existing local posts
  if (Array.isArray(existingPosts)) {
    existingPosts.forEach(p => {
      if (p && p.id && !deletedIds.has(p.id)) {
        if (!map.has(p.id)) {
          map.set(p.id, p);
        } else {
          const cloudPost = map.get(p.id)!;
          const mergedCommentsMap = new Map<string, Comment>();
          (cloudPost.comments || []).forEach(c => c && c.id && mergedCommentsMap.set(c.id, c));
          (p.comments || []).forEach(c => c && c.id && mergedCommentsMap.set(c.id, c));
          const mergedComments = Array.from(mergedCommentsMap.values());
          mergedComments.sort((a, b) => ((a as any).createdAtMs || 0) - ((b as any).createdAtMs || 0));

          map.set(p.id, {
            ...cloudPost,
            comments: mergedComments,
            stats: {
              ...cloudPost.stats,
              likes: Math.max(cloudPost.stats?.likes || 0, p.stats?.likes || 0),
              replies: Math.max(cloudPost.stats?.replies || 0, p.stats?.replies || 0, mergedComments.length),
              reposts: Math.max(cloudPost.stats?.reposts || 0, p.stats?.reposts || 0),
              bookmarks: Math.max(cloudPost.stats?.bookmarks || 0, p.stats?.bookmarks || 0)
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
  return result;
}

// Listen to community posts in Firestore
export function subscribeToPosts(onPostsUpdate: (posts: Post[]) => void) {
  try {
    const postsRef = collection(db, POSTS_COLLECTION);
    const metaRef = doc(db, 'system_config', 'posts_seeded');
    const deletedDocRef = doc(db, 'system_config', 'deleted_posts');

    // Subscribe to cloud deleted posts list
    onSnapshot(deletedDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && Array.isArray(data.ids)) {
          const currentLocal = getDeletedPostIds();
          let changed = false;
          data.ids.forEach((id: string) => {
            if (!currentLocal.has(id)) {
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
    }, () => {});

    // Check seed status once on initialization
    getDoc(metaRef).then(async (metaSnap) => {
      if (!metaSnap.exists()) {
        try {
          const existingSnap = await getDocs(postsRef);
          if (existingSnap.empty) {
            await seedInitialPosts();
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

    return onSnapshot(postsRef, (snapshot) => {
      const deletedIds = getDeletedPostIds();
      if (snapshot.empty) {
        const fallbacks = INITIAL_POSTS.filter(p => !deletedIds.has(p.id));
        onPostsUpdate(fallbacks);
        return;
      }

      const postsList: Post[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Post;
        if (data && data.id && data.content && !deletedIds.has(data.id)) {
          postsList.push(data);
        }
      });

      if (postsList.length === 0) {
        // If all snapshot posts were deleted or invalid, fallback to remaining non-deleted initial posts if any
        const fallbacks = INITIAL_POSTS.filter(p => !deletedIds.has(p.id));
        if (fallbacks.length > 0 && snapshot.size === 0) {
          onPostsUpdate(fallbacks);
          return;
        }
      }

      // Sort posts by newest
      postsList.sort((a, b) => {
        const timeA = (a as any).createdAtMs || 0;
        const timeB = (b as any).createdAtMs || 0;
        return timeB - timeA;
      });

      onPostsUpdate(postsList);
    }, (error) => {
      console.error('Firestore posts subscription error:', error);
    });
  } catch (e) {
    console.error('Failed to subscribe to posts:', e);
    return () => {};
  }
}

// Seed initial posts to Firestore
async function seedInitialPosts() {
  try {
    const deletedIds = getDeletedPostIds();
    const batch = writeBatch(db);
    let count = 0;
    INITIAL_POSTS.forEach((post, index) => {
      if (!deletedIds.has(post.id)) {
        count++;
        const postRef = doc(db, POSTS_COLLECTION, post.id);
        const postData: any = { ...post };
        Object.keys(postData).forEach(key => {
          if (postData[key] === undefined) delete postData[key];
        });
        const createdAtMs = post.createdAtMs || (Date.now() - index * 3600000);
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
  } catch (e) {
    console.error('Failed to seed initial posts:', e);
  }
}

// Save or Update post in Firestore
export async function savePostToFirestore(post: Post): Promise<void> {
  if (!post || !post.id) return;
  const deletedIds = getDeletedPostIds();
  if (deletedIds.has(post.id)) return; // Don't save deleted post

  try {
    const postData: any = { ...post };
    Object.keys(postData).forEach(key => {
      if (postData[key] === undefined) {
        delete postData[key];
      }
    });
    const postRef = doc(db, POSTS_COLLECTION, post.id);
    await setDoc(postRef, {
      ...postData,
      createdAtMs: (post as any).createdAtMs || Date.now()
    }, { merge: true });
  } catch (e) {
    console.warn('Error saving post to Firestore (using local fallback):', e);
  }
}

// Save all posts list to Firestore
export async function syncPostsToFirestore(posts: Post[]): Promise<void> {
  try {
    const deletedIds = getDeletedPostIds();
    const batch = writeBatch(db);
    posts.forEach((post) => {
      if (!deletedIds.has(post.id)) {
        const postRef = doc(db, POSTS_COLLECTION, post.id);
        batch.set(postRef, {
          ...post,
          createdAtMs: (post as any).createdAtMs || Date.now()
        }, { merge: true });
      }
    });
    const metaRef = doc(db, 'system_config', 'posts_seeded');
    batch.set(metaRef, { seeded: true, updatedAt: Date.now() });
    await batch.commit();
  } catch (e) {
    console.error('Error syncing posts to Firestore:', e);
  }
}

// Delete post from Firestore
export async function deletePostFromFirestore(postId: string): Promise<void> {
  if (!postId) return;
  markPostAsDeletedLocally(postId);

  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await deleteDoc(postRef).catch(() => {});

    // Sync deleted post IDs with Cloud Firestore
    const deletedDocRef = doc(db, 'system_config', 'deleted_posts');
    const ids = Array.from(getDeletedPostIds());
    await setDoc(deletedDocRef, { ids, updatedAt: Date.now() }, { merge: true }).catch(() => {});
  } catch (e) {
    console.warn('Error deleting post from Firestore (local removal preserved):', e);
  }
}
