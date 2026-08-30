import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { SidebarLeft } from './components/SidebarLeft';
import { Feed } from './components/Feed';
import { SidebarRight } from './components/SidebarRight';
import { AuthModal } from './components/AuthModal';
import { OnlineMembersModal } from './components/OnlineMembersModal';
import { NotificationsModal } from './components/NotificationsModal';
import { AdminBoardModal } from './components/AdminBoardModal';
import { ExternalLinkModal } from './components/ExternalLinkModal';
import { AdminPasswordModal } from './components/AdminPasswordModal';
import { EditProfileModal } from './components/EditProfileModal';
import { UserProfileModal } from './components/UserProfileModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MessageSquare, Search, Bell, BookA, User as UserIcon, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { SessionUser, AppNotification, Post, User } from './types';
import { resolveUserAccount, getInitialNotifications, getRegisteredUsers, getAllRegisteredUsersList, deleteRegisteredUser, clearAllRegisteredUsers, saveRegisteredUser, mtFeedChannel, maskUid, formatUserBadge } from './utils/auth';
import { subscribeToPosts, subscribeToUsers, deletePostFromFirestore, deleteUserFromFirestore, clearAllUsersFromFirestore, saveUserToFirestore, getDeletedPostIds, markPostAsDeletedLocally, mergePostsLists, savePostToFirestore, syncPostsToFirestore } from './utils/firestoreService';
import { formatRealTime } from './utils/timeUtils';
import { INITIAL_POSTS } from './data';

// Helper function to extract user from URL search params, hash, or sessionStorage
function getInitialUser(): SessionUser | null {
  try {
    let params: URLSearchParams | null = null;
    let isFromValidSource = false;
    
    if (typeof window !== 'undefined') {
      const referrer = document.referrer || '';
      // Only allow auto-login via URL if the user clicked a link from the official exam site or navigating within the app itself
      if (
        referrer.includes('mtexam-passalldiwa.ai.studio') || 
        referrer.includes('mt-feed.vercel.app') ||
        referrer.includes('localhost') ||
        referrer.includes('127.0.0.1') ||
        referrer.includes('ai.studio') // allow dev preview
      ) {
        isFromValidSource = true;
      }
      
      if (window.location.search) {
        params = new URLSearchParams(window.location.search);
      } else if (window.location.hash && window.location.hash.includes('?')) {
        params = new URLSearchParams(window.location.hash.split('?')[1]);
      }
    }

    if (params) {
      const usernameParam = params.get('username') || params.get('user') || params.get('u') || params.get('student_name') || params.get('name') || params.get('id');
      const uidParam = params.get('uid') || params.get('userId') || params.get('user_id') || params.get('student_id') || params.get('token') || params.get('key');
      const displayNameParam = params.get('displayName') || params.get('display_name') || params.get('fullname') || params.get('name');
      const avatarParam = params.get('avatar') || params.get('picture') || params.get('photo') || params.get('img') || params.get('avatar_url');
      const roleParam = params.get('role') || params.get('isAdmin') || params.get('is_admin') || params.get('admin');
      const userGroupParam = params.get('userGroup') || params.get('role_group') || params.get('group') || params.get('status') || params.get('user_group');
      const academicYearParam = params.get('academicYear') || params.get('academic_year') || params.get('year') || params.get('class_year');
      const facultyParam = params.get('faculty') || params.get('fac') || params.get('department');
      const universityParam = params.get('university') || params.get('uni') || params.get('u_name') || params.get('institution') || params.get('school');

      if (usernameParam || uidParam) {
        if (isFromValidSource) {
          const autoUser = resolveUserAccount({
            username: usernameParam || uidParam || 'user',
            uidParam,
            displayName: displayNameParam,
            avatar: avatarParam,
            role: roleParam,
            userGroupParam,
            academicYearParam,
            facultyParam,
            universityParam
          });

          // 1. บันทึกลงใน sessionStorage
          try {
            sessionStorage.setItem('mtfeed_user', JSON.stringify(autoUser));
            localStorage.setItem('mtfeed_user', JSON.stringify(autoUser));
          } catch (e) {
            console.error('Error saving user to storage:', e);
          }

          // 2. ลบ Query Parameters ทั้งหมดออกจาก URL ทันที
          try {
            if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
              const cleanUrl = window.location.pathname + (window.location.hash ? window.location.hash.split('?')[0] : '');
              window.history.replaceState({}, document.title, cleanUrl);
            }
          } catch (e) {
            console.error('Error clearing URL parameters:', e);
          }

          return autoUser;
        } else {
          console.warn("Blocked auto-login attempt from unauthorized origin or direct URL entry.");
          try {
            if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
              const cleanUrl = window.location.pathname + (window.location.hash ? window.location.hash.split('?')[0] : '');
              window.history.replaceState({}, document.title, cleanUrl);
            }
          } catch (e) {
            console.error('Error clearing URL parameters:', e);
          }
        }
      }
    }

    // 3. ถ้าไม่มีใน URL ให้อ่านจาก sessionStorage (หรือ localStorage fallback)
    if (typeof window !== 'undefined') {
      const sessionData = sessionStorage.getItem('mtfeed_user');
      if (sessionData) {
        return JSON.parse(sessionData);
      }
      const localData = localStorage.getItem('mtfeed_user');
      if (localData) {
        const parsed = JSON.parse(localData);
        sessionStorage.setItem('mtfeed_user', localData);
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error parsing initial user:', e);
  }
  return null;
}

export default function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [externalSharedText, setExternalSharedText] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAdminBoardOpen, setIsAdminBoardOpen] = useState(false);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [viewingProfileUser, setViewingProfileUser] = useState<SessionUser | User | null>(null);
  const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showWelcomeAlert, setShowWelcomeAlert] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(getInitialUser);

  // Real Registered Users state
  const [registeredUsers, setRegisteredUsers] = useState<SessionUser[]>(() => {
    const list = getAllRegisteredUsersList();
    const currentUser = getInitialUser();
    if (currentUser) {
      const exists = list.some(u => u.username.toLowerCase() === currentUser.username.toLowerCase() || u.uid === currentUser.uid);
      if (!exists) list.push(currentUser);
    }
    return list;
  });

  // Real-time synchronization for registered users, posts, and notifications from Firestore & local broadcast
  useEffect(() => {
    // 1. Subscribe to Cloud Firestore Users
    const unsubscribeUsers = subscribeToUsers((firestoreUsers) => {
      if (firestoreUsers) {
        // Sync to local registry cache, preserving local custom profile changes
        try {
          const localRegistry = getRegisteredUsers();
          const regMap: Record<string, SessionUser> = { ...localRegistry };
          
          firestoreUsers.forEach(u => {
            const key = u.uid || u.username || u.id;
            if (key) {
              const existingLocal = localRegistry[key];
              regMap[key] = {
                ...(u || {}),
                ...(existingLocal || {}),
                uid: u.uid || existingLocal?.uid || key,
                username: u.username || existingLocal?.username || key,
                name: existingLocal?.name || u.name,
                avatar: existingLocal?.avatar || u.avatar
              } as SessionUser;
            }
          });

          // Ensure current logged in user is in registry & Firestore
          const currentUserRaw = localStorage.getItem('mtfeed_user');
          if (currentUserRaw) {
            try {
              const cur = JSON.parse(currentUserRaw);
              if (cur && (cur.uid || cur.username)) {
                const key = cur.uid || cur.username || cur.id;
                regMap[key] = {
                  ...(regMap[key] || {}),
                  ...cur
                };
                saveUserToFirestore(regMap[key]);
              }
            } catch (e) {}
          }

          localStorage.setItem('mtfeed_accounts_registry', JSON.stringify(regMap));
          setRegisteredUsers(Object.values(regMap));
        } catch (e) {}
      }
    });

    // 2. Subscribe to Cloud Firestore Posts
    const unsubscribePosts = subscribeToPosts((firestorePosts) => {
      if (firestorePosts !== undefined && firestorePosts !== null) {
        setPosts(prevPosts => {
          const merged = mergePostsLists(firestorePosts, prevPosts);
          try {
            localStorage.setItem('mtfeed_posts', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
    });

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mtfeed_accounts_registry') {
        setRegisteredUsers(getAllRegisteredUsersList());
      }
      if (e.key === 'mtfeed_posts') {
        const saved = localStorage.getItem('mtfeed_posts');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setPosts(prevPosts => mergePostsLists(parsed, prevPosts));
          } catch (err) {}
        }
      }
      if (e.key === 'mtfeed_notifications') {
        const saved = localStorage.getItem('mtfeed_notifications');
        if (saved) {
          try {
            setNotifications(JSON.parse(saved));
          } catch (err) {}
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    let channelListener: ((event: MessageEvent) => void) | null = null;
    if (mtFeedChannel) {
      channelListener = (event: MessageEvent) => {
        if (event.data) {
          if (event.data.type === 'USER_REGISTERED') {
            setRegisteredUsers(getAllRegisteredUsersList());
          }
          if (event.data.type === 'POSTS_UPDATED') {
            const saved = localStorage.getItem('mtfeed_posts');
            if (saved) {
              try {
                const parsed = JSON.parse(saved);
                setPosts(prevPosts => mergePostsLists(parsed, prevPosts));
              } catch (err) {}
            }
          }
          if (event.data.type === 'NOTIFICATIONS_UPDATED') {
            const saved = localStorage.getItem('mtfeed_notifications');
            if (saved) {
              try {
                setNotifications(JSON.parse(saved));
              } catch (err) {}
            }
          }
        }
      };
      mtFeedChannel.addEventListener('message', channelListener);
    }

    return () => {
      unsubscribeUsers();
      unsubscribePosts();
      window.removeEventListener('storage', handleStorageChange);
      if (mtFeedChannel && channelListener) {
        mtFeedChannel.removeEventListener('message', channelListener);
      }
    };
  }, []);

  // Global Posts State
  const [posts, setPosts] = useState<Post[]>(() => {
    const deletedIds = getDeletedPostIds();
    const saved = localStorage.getItem('mtfeed_posts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: Post) => p && p.id && !deletedIds.has(p.id));
        }
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  // Always sync logged in user to Firestore and local registry
  useEffect(() => {
    if (user) {
      saveRegisteredUser(user);
      saveUserToFirestore(user);
    }
  }, [user]);

  // Save posts to localStorage for offline cache
  useEffect(() => {
    try {
      const deletedIds = getDeletedPostIds();
      const validPosts = (posts || []).filter(p => p && p.id && !deletedIds.has(p.id));
      localStorage.setItem('mtfeed_posts', JSON.stringify(validPosts));
      if (mtFeedChannel) {
        mtFeedChannel.postMessage({ type: 'POSTS_UPDATED' });
      }
    } catch (e) {
      console.error(e);
    }
  }, [posts]);

  // Persistent Notifications State
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('mtfeed_notifications');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return getInitialNotifications(getInitialUser());
  });

  // Save notifications to localStorage and broadcast
  useEffect(() => {
    try {
      localStorage.setItem('mtfeed_notifications', JSON.stringify(notifications));
      if (mtFeedChannel) {
        mtFeedChannel.postMessage({ type: 'NOTIFICATIONS_UPDATED' });
      }
    } catch (e) {
      console.error(e);
    }
  }, [notifications]);

  useEffect(() => {
    // Check if user came with URL params just now
    let params: URLSearchParams | null = null;
    let isFromValidSource = false;

    if (window.location.search) {
      params = new URLSearchParams(window.location.search);
    } else if (window.location.hash && window.location.hash.includes('?')) {
      params = new URLSearchParams(window.location.hash.split('?')[1]);
    }
    
    if (typeof window !== 'undefined') {
      const referrer = document.referrer || '';
      if (
        referrer.includes('mtexam-passalldiwa.ai.studio') || 
        referrer.includes('mt-feed.vercel.app') ||
        referrer.includes('localhost') ||
        referrer.includes('127.0.0.1') ||
        referrer.includes('ai.studio')
      ) {
        isFromValidSource = true;
      }
    }

    if (params) {
      const usernameParam = params.get('username') || params.get('user') || params.get('u') || params.get('student_name') || params.get('name') || params.get('id');
      const shareText = params.get('share_text') || params.get('text') || params.get('q');
      
      if (usernameParam && isFromValidSource) {
        setShowWelcomeAlert(true);
        const timer = setTimeout(() => setShowWelcomeAlert(false), 7000);
        return () => clearTimeout(timer);
      }

      if (shareText) {
        setExternalSharedText(decodeURIComponent(shareText));
      }
    }
  }, []);

  const handleLogin = (username: string, isAdmin: boolean, verifiedAdmin?: boolean, avatar?: string, displayName?: string) => {
    const userData = resolveUserAccount({
      username,
      displayName,
      avatar,
      role: isAdmin ? 'admin' : undefined,
      verifiedAdmin
    });
    setUser(userData);
    saveRegisteredUser(userData);
    saveUserToFirestore(userData);
    setRegisteredUsers(getAllRegisteredUsersList());
    try {
      localStorage.setItem('mtfeed_user', JSON.stringify(userData));
      sessionStorage.setItem('mtfeed_user', JSON.stringify(userData));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveProfile = (updatedData: Partial<SessionUser>) => {
    if (!user) return;
    const updatedUser: SessionUser = {
      ...user,
      ...updatedData
    };
    setUser(updatedUser);
    saveRegisteredUser(updatedUser);
    saveUserToFirestore(updatedUser);
    try {
      localStorage.setItem('mtfeed_user', JSON.stringify(updatedUser));
      sessionStorage.setItem('mtfeed_user', JSON.stringify(updatedUser));
      
      const registry = getRegisteredUsers();
      const key = updatedUser.uid || updatedUser.username;
      if (key) {
        registry[key] = updatedUser;
        localStorage.setItem('mtfeed_accounts_registry', JSON.stringify(registry));
      }
    } catch (e) {}

    // Update registeredUsers list in state
    setRegisteredUsers(getAllRegisteredUsersList());

    // Also update existing posts & comments in memory AND persist to localStorage and Firestore
    setPosts(prevPosts => {
      const updated = prevPosts.map(p => {
        const isAuthor = (
          (p.author.username && user.username && p.author.username.replace(/^@/, '').toLowerCase() === user.username.replace(/^@/, '').toLowerCase()) ||
          (p.author.id && user.uid && p.author.id === user.uid)
        );
        let postChanged = false;
        let newAuthor = p.author;
        if (isAuthor) {
          postChanged = true;
          newAuthor = {
            ...p.author,
            name: updatedUser.name || p.author.name,
            avatar: updatedUser.avatar || p.author.avatar
          };
        }
        const updatedComments = (p.comments || []).map(c => {
          const isCommentAuthor = (
            (c.author.username && user.username && c.author.username.replace(/^@/, '').toLowerCase() === user.username.replace(/^@/, '').toLowerCase()) ||
            (c.author.id && user.uid && c.author.id === user.uid)
          );
          if (isCommentAuthor) {
            postChanged = true;
            return {
              ...c,
              author: {
                ...c.author,
                name: updatedUser.name || c.author.name,
                avatar: updatedUser.avatar || c.author.avatar
              }
            };
          }
          return c;
        });

        if (postChanged) {
          return {
            ...p,
            author: newAuthor,
            comments: updatedComments
          };
        }
        return p;
      });

      // Persist updated posts to localStorage and Firestore
      try {
        localStorage.setItem('mtfeed_posts', JSON.stringify(updated));
      } catch (e) {}
      syncPostsToFirestore(updated).catch(() => {});

      return updated;
    });
  };

  const handleOpenExternalUrl = (url: string) => {
    // Whitelist MTExam so it opens directly without safety warning modal
    if (url.includes('mtexam-passalldiwa.ai.studio')) {
      const target = url.startsWith('http') ? url : `https://${url}`;
      window.open(target, '_blank', 'noopener,noreferrer');
      return;
    }
    setPendingExternalUrl(url);
  };

  const handleLogout = () => {
    setUser(null);
    setShowWelcomeAlert(false);
    try {
      localStorage.removeItem('mtfeed_user');
      sessionStorage.removeItem('mtfeed_user');
    } catch (e) {
      console.error(e);
    }
  };

  // Admin & User Delete Post Function
  const handleDeletePost = async (postId: string) => {
    const targetPost = posts.find(p => p.id === postId);
    if (targetPost) {
      const isOwner = Boolean(user && (
        (user.username && targetPost.author.username && user.username.replace(/^@/, '').toLowerCase() === targetPost.author.username.replace(/^@/, '').toLowerCase()) ||
        (user.uid && targetPost.author.id && user.uid === targetPost.author.id) ||
        (user.id && targetPost.author.id && user.id === targetPost.author.id)
      ));
      const isAdmin = Boolean(user?.isAdmin && !user?.needsAdminVerification);
      if (!isOwner && !isAdmin) {
        alert('❌ คุณไม่มีสิทธิ์ลบโพสต์นี้ (เฉพาะเจ้าของโพสต์หรือ Admin เท่านั้น)');
        return;
      }
    }

    markPostAsDeletedLocally(postId);

    setPosts(prev => {
      const filtered = prev.filter(p => p.id !== postId);
      try {
        localStorage.setItem('mtfeed_posts', JSON.stringify(filtered));
      } catch (e) {}
      return filtered;
    });
    await deletePostFromFirestore(postId);
  };

  // Admin Delete User Function
  const handleDeleteUser = async (uidOrUsername: string) => {
    if (!user?.isAdmin) {
      alert('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบบัญชีสมาชิกได้');
      return;
    }
    deleteRegisteredUser(uidOrUsername);
    await deleteUserFromFirestore(uidOrUsername);
    const updatedUsers = getAllRegisteredUsersList();
    setRegisteredUsers(updatedUsers);

    // If current logged-in user was deleted, log out
    if (user && (user.uid === uidOrUsername || user.username.toLowerCase() === uidOrUsername.toLowerCase())) {
      handleLogout();
    }
  };

  // Admin Clear All Users Function
  const handleClearAllUsers = async () => {
    if (!user?.isAdmin) {
      alert('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถล้างรายชื่อสมาชิกได้');
      return;
    }
    clearAllRegisteredUsers(user || undefined);
    await clearAllUsersFromFirestore(user || undefined);
    const updatedUsers = getAllRegisteredUsersList();
    setRegisteredUsers(updatedUsers);
  };

  // Trigger @mention notification
  const handleMentionNotification = (mentionData: {
    recipientUsername: string;
    authorName: string;
    authorAvatar?: string;
    contentPreview: string;
    targetPostId?: string;
  }) => {
    const nowMs = Date.now();
    const newNotif: AppNotification = {
      id: `mention_${nowMs}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'mention',
      title: `@${mentionData.authorName} ได้กล่าวถึงคุณในโพสต์`,
      description: mentionData.contentPreview.length > 90 ? mentionData.contentPreview.slice(0, 90) + '...' : mentionData.contentPreview,
      authorName: mentionData.authorName,
      authorAvatar: mentionData.authorAvatar,
      targetPostId: mentionData.targetPostId,
      recipientUsername: mentionData.recipientUsername.toLowerCase(),
      createdAt: formatRealTime(nowMs),
      createdAtMs: nowMs,
      read: false
    };

    setNotifications(prev => [newNotif, ...prev]);
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleReportPost = (postId: string) => {
    const targetPost = posts.find(p => p.id === postId);
    if (targetPost) {
      const nowMs = Date.now();
      const reportNotif: AppNotification = {
        id: `report_${nowMs}_${Math.random().toString(36).substr(2, 5)}`,
        type: 'system',
        title: `🚨 มีรายงานโพสต์ไม่เหมาะสม (${targetPost.author.name})`,
        description: `โพสต์: "${targetPost.content.slice(0, 60)}..." ถูกรายงานโดยผู้ใช้งาน กรุณาตรวจสอบในแดชบอร์ดแอดมิน`,
        targetPostId: postId,
        recipientUsername: 'admin',
        createdAt: formatRealTime(nowMs),
        createdAtMs: nowMs,
        read: false
      };
      setNotifications(prev => [reportNotif, ...prev]);
    }
  };

  const handleInteraction = (postId: string, type: 'reply' | 'repost' | 'like' | 'bookmark') => {
    if (!user && type !== 'reply') {
      window.open('https://mtexam-passalldiwa.ai.studio/', '_blank');
      return;
    }

    const targetPost = posts.find(p => p.id === postId);
    if (targetPost) {
      const newStats = { ...targetPost.stats };
      const newInteractions = { ...(targetPost.userInteractions || {}) };
      let newRepostedBy = [...(targetPost.repostedBy || [])];
      let newRepostedUsers = [...(targetPost.repostedUsers || [])];

      if (type === 'like') {
        const currentlyLiked = newInteractions.liked;
        newInteractions.liked = !currentlyLiked;
        newStats.likes += currentlyLiked ? -1 : 1;
      } else if (type === 'repost') {
        const currentlyReposted = newInteractions.reposted;
        newInteractions.reposted = !currentlyReposted;
        newStats.reposts += currentlyReposted ? -1 : 1;

        if (user) {
          const username = user.username;
          if (newInteractions.reposted) {
            if (!newRepostedBy.includes(username)) {
              newRepostedBy.push(username);
            }
            if (!newRepostedUsers.some(u => u.username === username)) {
              newRepostedUsers.push({
                username: user.username,
                name: user.name || user.username,
                avatar: user.avatar,
                uid: user.uid
              });
            }
          } else {
            newRepostedBy = newRepostedBy.filter(u => u !== username);
            newRepostedUsers = newRepostedUsers.filter(u => u.username !== username);
          }
        }
      } else if (type === 'bookmark') {
        const currentlyBookmarked = newInteractions.bookmarked;
        newInteractions.bookmarked = !currentlyBookmarked;
        newStats.bookmarks += currentlyBookmarked ? -1 : 1;
      }

      const updatedPost: Post = {
        ...targetPost,
        stats: newStats,
        userInteractions: newInteractions,
        repostedBy: newRepostedBy,
        repostedUsers: newRepostedUsers
      };

      setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
      savePostToFirestore(updatedPost);
    }
  };

  const handleVote = (postId: string, optionId: string) => {
    if (!user) {
      window.open('https://mtexam-passalldiwa.ai.studio/', '_blank');
      return;
    }

    const targetPost = posts.find(p => p.id === postId);
    if (targetPost && targetPost.poll && !targetPost.userInteractions?.votedOptionId) {
      const newPoll = { ...targetPost.poll };
      newPoll.options = newPoll.options.map(opt => {
        if (opt.id === optionId) {
          return { ...opt, votes: opt.votes + 1 };
        }
        return opt;
      });
      newPoll.totalVotes += 1;

      const newInteractions = {
        ...(targetPost.userInteractions || {}),
        votedOptionId: optionId
      };

      const updatedPost: Post = {
        ...targetPost,
        poll: newPoll,
        userInteractions: newInteractions
      };

      setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
      savePostToFirestore(updatedPost);
    }
  };

  const handleComment = (postId: string, content: string) => {
    if (!user) {
      window.open('https://mtexam-passalldiwa.ai.studio/', '_blank');
      return;
    }

    const nowMs = Date.now();
    const newComment = {
      id: `comment_${nowMs}_${Math.random().toString(36).substr(2, 5)}`,
      author: {
        id: user.uid,
        name: user.name || user.username,
        username: user.username,
        avatar: user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=cccccc`,
        isVerified: user.isAdmin,
        isAdmin: user.isAdmin,
        badge: formatUserBadge(user),
        faculty: user.faculty,
        university: user.university
      },
      content,
      createdAt: formatRealTime(nowMs),
      createdAtMs: nowMs,
      likes: 0
    };

    const targetPost = posts.find(p => p.id === postId);
    if (targetPost) {
      const updatedComments = [...(targetPost.comments || []), newComment];
      const newStats = {
        ...targetPost.stats,
        replies: updatedComments.length
      };

      const updatedPost: Post = {
        ...targetPost,
        comments: updatedComments,
        stats: newStats
      };

      setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
      savePostToFirestore(updatedPost);
    }
  };

  const handleViewProfile = (userToView: SessionUser | User) => {
    const lookupKey = (userToView.username || '').replace(/^@/, '').toLowerCase();
    const lookupUid = (userToView as SessionUser).uid || userToView.id;

    const foundInRegistry = registeredUsers.find(u => 
      (u.username && u.username.replace(/^@/, '').toLowerCase() === lookupKey) ||
      (lookupUid && u.uid === lookupUid)
    );

    if (foundInRegistry) {
      setViewingProfileUser(foundInRegistry);
    } else {
      setViewingProfileUser(userToView);
    }
  };

  // Notifications relevant for current user:
  // - System notifications (no recipientUsername)
  // - OR notifications specifically targeting admin (if user is admin)
  // - OR notifications specifically targeting this user's username / UID
  const relevantNotifications = notifications.filter(n => {
    if (!n.recipientUsername) return true; // public system notifications
    if (n.recipientUsername === 'admin' && user?.isAdmin) return true; // admin report notifications
    if (!user) return false;
    return n.recipientUsername === user.username.toLowerCase() || n.recipientUsername === user.uid.toLowerCase();
  });

  const unreadNotificationsCount = relevantNotifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-white">
      {/* Banner if no session found */}
      {!user && (
        <div className="bg-amber-500 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-sm sticky top-0 z-50">
          <div className="flex items-center space-x-2 max-w-5xl mx-auto flex-1">
            <span className="font-semibold text-base">⚠️</span>
            <span className="font-medium">
              ไม่พบข้อมูลการเข้าใช้งาน กรุณาเข้าสู่ระบบผ่านเว็บไซต์หลักเท่านั้น
            </span>
          </div>
          <a 
            href="https://mtexam-passalldiwa.ai.studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1 bg-white text-amber-900 rounded-lg text-xs font-semibold hover:bg-amber-50 transition-colors shadow-sm ml-2 flex-shrink-0 text-center"
          >
            ไปที่เว็บไซต์หลัก
          </a>
        </div>
      )}

      {/* Welcome Banner when connected */}
      {showWelcomeAlert && user && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-sm sticky top-0 z-50 animate-fadeIn">
          <div className="flex items-center space-x-2 max-w-5xl mx-auto flex-1">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-yellow-300" />
            <span className="font-medium truncate">
              เข้าสู่ระบบด้วยรหัสปลอดภัย 8 หลัก: <b>{user.name || user.username}</b> (@{user.username}) • 
              <span className="ml-1 font-mono bg-white/25 px-2 py-0.5 rounded text-xs">UID: #{maskUid(user.uid, user)}</span>
              {user.isAdmin && ' 👑 Admin'}
            </span>
          </div>
          <button 
            onClick={() => setShowWelcomeAlert(false)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <Navbar 
        user={user} 
        onLoginClick={() => window.open('https://mtexam-passalldiwa.ai.studio/', '_blank')} 
        onAdminClick={() => setIsAdminBoardOpen(true)}
        onEditProfileClick={() => user ? setIsEditProfileOpen(true) : window.open('https://mtexam-passalldiwa.ai.studio/', '_blank')}
        onViewProfile={handleViewProfile}
        onLogoutClick={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        unreadCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsModalOpen(true)}
        onExternalLinkClick={handleOpenExternalUrl}
      />
      
      <main className="max-w-7xl mx-auto flex justify-center lg:justify-between px-0 sm:px-4 lg:px-8">
        <SidebarLeft 
          activeCategory={activeCategory} 
          setActiveCategory={(cat) => {
            setActiveCategory(cat);
            setSelectedTag(null);
          }}
          unreadCount={unreadNotificationsCount}
          onOpenNotifications={() => setIsNotificationsModalOpen(true)}
          onEditProfileClick={() => user ? setIsEditProfileOpen(true) : window.open('https://mtexam-passalldiwa.ai.studio/', '_blank')}
          onViewProfile={handleViewProfile}
          onLogoutClick={handleLogout}
          currentUser={user}
        />
        
        <Feed 
          posts={posts}
          setPosts={setPosts}
          activeCategory={activeCategory} 
          user={user} 
          onLoginClick={() => window.open('https://mtexam-passalldiwa.ai.studio/', '_blank')} 
          isAdminBoardOpen={isAdminBoardOpen}
          onCloseAdminBoard={() => setIsAdminBoardOpen(false)}
          externalSharedText={externalSharedText}
          onClearExternalSharedText={() => setExternalSharedText(null)}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery('')}
          registeredUsers={registeredUsers}
          onMention={handleMentionNotification}
          onExternalLinkClick={handleOpenExternalUrl}
          onReportPost={handleReportPost}
          onProfileClick={handleViewProfile}
        />
        
        <SidebarRight 
          posts={posts}
          currentUser={user}
          onlineUsers={registeredUsers}
          selectedTag={selectedTag}
          onSelectTag={setSelectedTag}
          onOpenOnlineModal={() => setIsOnlineModalOpen(true)}
        />
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-14">
          <button 
            onClick={() => {
              setActiveCategory('all');
              setSelectedTag(null);
              setSearchQuery('');
            }}
            className="p-2 flex flex-col items-center text-red-600" 
            title="หน้าฟีด"
          >
            <MessageSquare className="w-6 h-6" />
          </button>
          <a 
            href="https://mtexam-passalldiwa.ai.studio/" 
            onClick={(e) => {
              e.preventDefault();
              handleOpenExternalUrl('https://mtexam-passalldiwa.ai.studio/');
            }}
            className="p-2 text-gray-700 hover:text-red-600 transition-colors flex flex-col items-center"
            title="คลังข้อสอบ"
          >
            <BookA className="w-6 h-6" />
          </a>
          <button 
            onClick={() => setIsNotificationsModalOpen(true)}
            className="p-2 text-gray-500 hover:text-red-600 transition-colors flex flex-col items-center relative"
            title="การแจ้งเตือน"
          >
            <span className="relative">
              {unreadNotificationsCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 bg-red-600 text-white rounded-full absolute -top-1 -right-2 text-[10px] font-bold flex items-center justify-center">
                  {unreadNotificationsCount}
                </span>
              )}
              <Bell className="w-6 h-6" />
            </span>
          </button>
          <button 
            onClick={() => user ? handleViewProfile(user) : window.open('https://mtexam-passalldiwa.ai.studio/', '_blank')} 
            className="p-2 text-gray-500 hover:text-gray-900 transition-colors flex flex-col items-center"
            title={user ? `@${user.username} (ดูโปรไฟล์และโพสต์)` : "เข้าสู่ระบบ"}
          >
            {user?.avatar ? (
              <img 
                src={user.avatar} 
                alt="Profile" 
                className="w-6 h-6 rounded-full object-cover ring-2 ring-red-500" 
              />
            ) : (
              <UserIcon className={`w-6 h-6 ${user ? 'text-red-600' : ''}`} />
            )}
          </button>
        </div>
      </div>
      
      {/* Padding for mobile bottom nav */}
      <div className="h-14 md:hidden"></div>

      {/* External Link Safety Warning Modal */}
      <ExternalLinkModal 
        isOpen={!!pendingExternalUrl}
        url={pendingExternalUrl || ''}
        onClose={() => setPendingExternalUrl(null)}
      />

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onLogin={handleLogin}
      />

      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        currentUser={user}
        onSaveProfile={handleSaveProfile}
      />

      <ErrorBoundary 
        fallbackTitle="เกิดข้อผิดพลาดในการเปิดหน้าโปรไฟล์" 
        onReset={() => setViewingProfileUser(null)}
      >
        <UserProfileModal
          isOpen={!!viewingProfileUser}
          onClose={() => setViewingProfileUser(null)}
          targetUser={viewingProfileUser}
          currentUser={user}
          allPosts={posts}
          onInteraction={handleInteraction}
          onVote={handleVote}
          onComment={handleComment}
          onDelete={handleDeletePost}
          onReport={handleReportPost}
          onSelectTag={(tag) => {
            setSelectedTag(tag);
            setViewingProfileUser(null);
          }}
          onExternalLinkClick={handleOpenExternalUrl}
          onEditProfileClick={() => {
            setViewingProfileUser(null);
            setIsEditProfileOpen(true);
          }}
          onMentionUserInPost={(mention) => {
            setExternalSharedText(mention + ' ');
            setViewingProfileUser(null);
          }}
          onSelectAnotherProfile={(otherUser) => {
            handleViewProfile(otherUser);
          }}
        />
      </ErrorBoundary>

      <OnlineMembersModal 
        isOpen={isOnlineModalOpen}
        onClose={() => setIsOnlineModalOpen(false)}
        currentUser={user}
        registeredUsers={registeredUsers}
        onDeleteUser={handleDeleteUser}
        onClearAllUsers={handleClearAllUsers}
        onVerifyAdmin={(pwd) => {
          if (pwd === 'Bank2546') {
            if (user) {
              const updated = { ...user, isAdmin: true, needsAdminVerification: false };
              setUser(updated);
              localStorage.setItem('mtfeed_user', JSON.stringify(updated));
              sessionStorage.setItem('mtfeed_user', JSON.stringify(updated));
            }
            return true;
          }
          return false;
        }}
        onSelectUserForPost={(mention) => {
          setExternalSharedText(mention);
        }}
        onViewProfile={(member) => {
          setIsOnlineModalOpen(false);
          handleViewProfile(member);
        }}
      />

      <NotificationsModal
        isOpen={isNotificationsModalOpen}
        onClose={() => setIsNotificationsModalOpen(false)}
        notifications={relevantNotifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onSelectNotification={(notif) => {
          if (notif.targetTag) {
            setSelectedTag(notif.targetTag);
            setIsNotificationsModalOpen(false);
          }
        }}
        user={user}
      />

      <AdminBoardModal 
        isOpen={isAdminBoardOpen} 
        onClose={() => setIsAdminBoardOpen(false)} 
        posts={posts} 
        onDeletePost={handleDeletePost}
        registeredUsers={registeredUsers}
        onDeleteUser={handleDeleteUser}
        currentUser={user}
      />

      {user?.needsAdminVerification && (
        <AdminPasswordModal
          username={user.username}
          onSuccess={() => {
            setUser(prev => prev ? { ...prev, needsAdminVerification: false, isAdmin: true } : null);
          }}
          onCancel={() => {
            localStorage.removeItem('mtfeed_user');
            sessionStorage.removeItem('mtfeed_user');
            setUser(null);
            window.location.search = '';
          }}
        />
      )}
    </div>
  );
}
