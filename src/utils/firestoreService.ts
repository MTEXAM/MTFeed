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

const USERS_COLLECTION = 'users';
const POSTS_COLLECTION = 'posts';

// Listen to registered users in Firestore
export function subscribeToUsers(onUsersUpdate: (users: SessionUser[]) => void) {
  try {
    const usersRef = collection(db, USERS_COLLECTION);
    return onSnapshot(usersRef, (snapshot) => {
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
    const userRef = doc(db, USERS_COLLECTION, docId);
    await setDoc(userRef, {
      ...user,
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
    let deleted = false;
    const batch = writeBatch(db);

    snapshot.forEach((docSnap) => {
      const u = docSnap.data() as SessionUser;
      const docId = docSnap.id.toLowerCase();
      if (
        docId === clean ||
        (u.uid && u.uid.toLowerCase().replace(/^#/, '') === clean) ||
        (u.username && u.username.toLowerCase().replace(/^@/, '') === clean)
      ) {
        batch.delete(docSnap.ref);
        deleted = true;
      }
    });

    if (deleted) {
      await batch.commit();
    }
    return deleted;
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
    const batch = writeBatch(db);

    snapshot.forEach((docSnap) => {
      const u = docSnap.data() as SessionUser;
      if (keepUser && (docSnap.id === keepUser.uid || u.username === keepUser.username)) {
        // Keep current admin user
      } else {
        batch.delete(docSnap.ref);
      }
    });

    await batch.commit();

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
        // Seed initial posts if Firestore collection is brand new
        seedInitialPosts();
        return;
      }
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
      batch.set(postRef, {
        ...post,
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
    const postRef = doc(db, POSTS_COLLECTION, post.id);
    await setDoc(postRef, {
      ...post,
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
