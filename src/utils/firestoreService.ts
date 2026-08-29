import { 
  collection, 
  doc, 
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

// Listen to community posts in Firestore
export function subscribeToPosts(onPostsUpdate: (posts: Post[]) => void) {
  try {
    const postsRef = collection(db, POSTS_COLLECTION);
    return onSnapshot(postsRef, (snapshot) => {
      if (snapshot.empty) {
        // Only seed initial posts if database has NEVER been initialized
        const hasSeeded = localStorage.getItem('mtfeed_has_seeded_v1');
        if (!hasSeeded) {
          localStorage.setItem('mtfeed_has_seeded_v1', 'true');
          seedInitialPosts();
          return;
        } else {
          onPostsUpdate([]);
          return;
        }
      }

      // Mark as seeded since posts exist
      localStorage.setItem('mtfeed_has_seeded_v1', 'true');

      const postsList: Post[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Post;
        if (data && data.id && data.content) {
          postsList.push(data);
        }
      });
      // Sort posts by newest (if timestamp or ID ordering)
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
    const batch = writeBatch(db);
    INITIAL_POSTS.forEach((post, index) => {
      const postRef = doc(db, POSTS_COLLECTION, post.id);
      const postData: any = { ...post };
      Object.keys(postData).forEach(key => {
        if (postData[key] === undefined) delete postData[key];
      });
      batch.set(postRef, {
        ...postData,
        createdAtMs: Date.now() - index * 3600000
      });
    });
    await batch.commit();
  } catch (e) {
    console.error('Failed to seed initial posts:', e);
  }
}

// Save or Update post in Firestore
export async function savePostToFirestore(post: Post): Promise<void> {
  if (!post || !post.id) return;
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
    console.error('Error saving post to Firestore:', e);
  }
}

// Save all posts list to Firestore
export async function syncPostsToFirestore(posts: Post[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    posts.forEach((post) => {
      const postRef = doc(db, POSTS_COLLECTION, post.id);
      batch.set(postRef, {
        ...post,
        createdAtMs: (post as any).createdAtMs || Date.now()
      }, { merge: true });
    });
    await batch.commit();
  } catch (e) {
    console.error('Error syncing posts to Firestore:', e);
  }
}

// Delete post from Firestore
export async function deletePostFromFirestore(postId: string): Promise<void> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    await deleteDoc(postRef);
  } catch (e) {
    console.error('Error deleting post from Firestore:', e);
  }
}
