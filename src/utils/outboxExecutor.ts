import { OutboxItem, systemHealthManager } from './systemHealthService';
import { savePostToFirestore, deletePostFromFirestore, saveUserToFirestore, deleteUserFromFirestore, syncPostsToFirestore, sendSystemBroadcastToFirestore } from './firestoreService';
import { syncPostToGoogleSheets, syncDeletePostToGoogleSheets, syncProfileToGoogleSheets } from './googleSheetsService';

export async function executeOutboxAction(item: OutboxItem): Promise<boolean> {
  try {
    switch (item.type) {
      case 'SAVE_POST': {
        const post = item.payload;
        if (post && post.id) {
          await savePostToFirestore(post);
          await syncPostToGoogleSheets(post);
          systemHealthManager.reportFirestoreSuccess();
          systemHealthManager.reportSheetsSuccess();
        }
        return true;
      }

      case 'DELETE_POST': {
        const { postId, content, uid } = item.payload;
        if (postId) {
          await deletePostFromFirestore(postId, content, uid);
          await syncDeletePostToGoogleSheets(postId, content, uid);
          systemHealthManager.reportFirestoreSuccess();
          systemHealthManager.reportSheetsSuccess();
        }
        return true;
      }

      case 'SAVE_USER': {
        const user = item.payload;
        if (user && (user.uid || user.username)) {
          await saveUserToFirestore(user);
          await syncProfileToGoogleSheets(user);
          systemHealthManager.reportFirestoreSuccess();
          systemHealthManager.reportSheetsSuccess();
        }
        return true;
      }

      case 'DELETE_USER': {
        const { uidOrUsername } = item.payload;
        if (uidOrUsername) {
          await deleteUserFromFirestore(uidOrUsername);
          systemHealthManager.reportFirestoreSuccess();
        }
        return true;
      }

      case 'SYNC_POSTS': {
        const posts = item.payload;
        if (Array.isArray(posts)) {
          await syncPostsToFirestore(posts);
          systemHealthManager.reportFirestoreSuccess();
        }
        return true;
      }

      case 'SEND_BROADCAST': {
        const broadcast = item.payload;
        if (broadcast && broadcast.title) {
          await sendSystemBroadcastToFirestore(broadcast);
          systemHealthManager.reportFirestoreSuccess();
        }
        return true;
      }

      default:
        return true;
    }
  } catch (err) {
    console.warn(`Error executing outbox item ${item.id}:`, err);
    return false;
  }
}
