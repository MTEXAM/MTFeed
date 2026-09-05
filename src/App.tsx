import React, { useState, useEffect, useRef } from 'react';
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
import { PostItem } from './components/PostItem';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SystemHealthModal } from './components/SystemHealthModal';
import { EmergencyAdminModal } from './components/EmergencyAdminModal';
import { SystemToastContainer, ToastItem } from './components/SystemToast';
import { MessageSquare, Search, Bell, BookA, User as UserIcon, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { SessionUser, AppNotification, Post, User } from './types';
import { resolveUserAccount, getInitialNotifications, getRegisteredUsers, getAllRegisteredUsersList, deleteRegisteredUser, clearAllRegisteredUsers, saveRegisteredUser, mtFeedChannel, maskUid, formatUserBadge, DEFAULT_ACTIVE_USERS, MAIN_SITE_URL, MAIN_SITE_HOST, sanitizeDisplayName, sanitizeUsername, setExplicitAvatar } from './utils/auth';
import { subscribeToPosts, subscribeToUsers, subscribeToSystemNotifications, sendSystemBroadcastToFirestore, deletePostFromFirestore, deleteUserFromFirestore, clearAllUsersFromFirestore, saveUserToFirestore, getDeletedPostIds, getPostSignature, markPostAsDeletedLocally, mergePostsLists, savePostToFirestore, syncPostsToFirestore, getUserFromFirestore, getBackupPostsFromSQLite, getBackupUsersFromSQLite, restoreBackupsToFirestore } from './utils/firestoreService';
import { fetchFeedFromGoogleSheets, fetchProfileFromGoogleSheets, syncProfileToGoogleSheets, syncPostToGoogleSheets, extractProfilesFromSheetPosts } from './utils/googleSheetsService';
import { systemHealthManager, SystemHealthState } from './utils/systemHealthService';
import { formatRealTime } from './utils/timeUtils';
import { INITIAL_POSTS } from './data';

// Helper function to extract user from URL search params, hash, or sessionStorage
function getInitialUser(): SessionUser | null {
  try {
    if (typeof window === 'undefined') return null;

    // A. Parse parameters from HEAD-captured sessionStorage OR directly from current URL as backup
    let paramsObj: Record<string, string> = {};
    
    // 1. Recover parameters saved instantly in index.html HEAD
    const savedParamsStr = sessionStorage.getItem('mtfeed_pending_url_params');
    if (savedParamsStr) {
      try {
        paramsObj = JSON.parse(savedParamsStr);
        // Clear the consumed parameters so we do not process them again on reload
        sessionStorage.removeItem('mtfeed_pending_url_params');
      } catch (e) {
        console.error('Error parsing stored pending url params:', e);
      }
    }

    // 2. Read from URL directly as a fallback
    let params: URLSearchParams | null = null;
    if (window.location.search) {
      params = new URLSearchParams(window.location.search);
    } else if (typeof window.location.hash === 'string' && window.location.hash.includes('?')) {
      const parts = window.location.hash.split('?');
      if (parts[1]) {
        params = new URLSearchParams(parts[1]);
      }
    }

    if (params) {
      params.forEach((value, key) => {
        if (!paramsObj[key]) {
          paramsObj[key] = value;
        }
      });
      
      const pId = params.get('post') || params.get('postId') || params.get('post_id');
      if (pId) {
        sessionStorage.setItem('mtfeed_shared_post_id', pId);
      }
    } else if (paramsObj['post'] || paramsObj['postId'] || paramsObj['post_id']) {
      const pId = paramsObj['post'] || paramsObj['postId'] || paramsObj['post_id'];
      sessionStorage.setItem('mtfeed_shared_post_id', pId);
    }

    // Identify if credentials are present in either source
    const usernameParam = paramsObj['username'] || paramsObj['user'] || paramsObj['u'] || paramsObj['student_name'] || paramsObj['name'] || paramsObj['id'] || '';
    const uidParam = paramsObj['uid'] || paramsObj['userId'] || paramsObj['user_id'] || paramsObj['student_id'] || paramsObj['token'] || paramsObj['key'] || '';
    const hasCredentials = !!(usernameParam || uidParam);

    // B. ALWAYS strip ALL parameters from URL as secondary backup (just in case)
    if (params && (hasCredentials || params.has('post') || params.has('postId') || params.has('post_id'))) {
      try {
        const hashStr = typeof window.location.hash === 'string' ? window.location.hash : '';
        const cleanUrl = window.location.pathname + (hashStr ? hashStr.split('?')[0] : '');
        window.history.replaceState({}, document.title, cleanUrl);
        console.log('Backup URL Stripping: Successfully sanitized address bar!');
      } catch (e) {
        console.error('Error in backup URL stripping:', e);
      }
    }
    
    // C. If credentials are provided in URL / pending params, process auto-login FIRST
    if (hasCredentials) {
      const displayNameParam = paramsObj['displayName'] || paramsObj['display_name'] || paramsObj['fullname'] || paramsObj['name'] || paramsObj['student_name'];
      const avatarParam = paramsObj['avatar'] || paramsObj['picture'] || paramsObj['photo'] || paramsObj['img'] || paramsObj['avatar_url'];
      const roleParam = paramsObj['role'] || paramsObj['isAdmin'] || paramsObj['is_admin'] || paramsObj['admin'];
      const userGroupParam = paramsObj['userGroup'] || paramsObj['role_group'] || paramsObj['group'] || paramsObj['status'] || paramsObj['user_group'];
      const academicYearParam = paramsObj['academicYear'] || paramsObj['academic_year'] || paramsObj['year'] || paramsObj['class_year'];
      const facultyParam = paramsObj['faculty'] || paramsObj['fac'] || paramsObj['department'];
      const universityParam = paramsObj['university'] || paramsObj['uni'] || paramsObj['u_name'] || paramsObj['institution'] || paramsObj['school'];

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

      // Save session
      try {
        sessionStorage.setItem('mtfeed_user', JSON.stringify(autoUser));
        localStorage.setItem('mtfeed_user', JSON.stringify(autoUser));
      } catch (e) {
        console.error('Error saving auto user session:', e);
      }

      // Immediately sync profile to Google Sheets
      syncProfileToGoogleSheets(autoUser).catch(err => console.warn('[SHEETS INSTANT AUTO SYNC ERROR]', err));

      return autoUser;
    }

    // D. If no incoming credentials in URL, check storage for an existing session
    const upgradeIfAdmin = (parsed: any) => {
      const isMedAdmin = parsed.uid === 'MED68001' || parsed.uid === '#MED68001' || parsed.id === 'MED68001' || parsed.id === '#MED68001' || parsed.username === 'bank';
      if (isMedAdmin) {
        parsed.isAdmin = true;
        parsed.badge = '👑 Admin';
        parsed.userGroup = '👑 Admin';
        if (!parsed.name || parsed.name === 'MED68001' || parsed.name === '#MED68001' || parsed.name === '👑 Admin') {
          parsed.name = 'Bank';
        }
        if (!parsed.username || parsed.username === 'MED68001' || parsed.username === '👑Admin') {
          parsed.username = 'bank';
        }
        if (typeof localStorage !== 'undefined') localStorage.setItem('mtfeed_user', JSON.stringify(parsed));
      }
      return parsed;
    };

    const sessionData = sessionStorage.getItem('mtfeed_user');
    if (sessionData) {
      return upgradeIfAdmin(JSON.parse(sessionData));
    }
    const localData = localStorage.getItem('mtfeed_user');
    if (localData) {
      const parsed = JSON.parse(localData);
      const upgraded = upgradeIfAdmin(parsed);
      sessionStorage.setItem('mtfeed_user', JSON.stringify(upgraded));
      return upgraded;
    }
  } catch (e) {
    console.error('Error parsing initial user:', e);
  }
  return null;
}

export function deduplicateNotifications(notifs: AppNotification[]): AppNotification[] {
  if (!Array.isArray(notifs)) return [];
  const map = new Map<string, AppNotification>();
  const seenRecentSignatures = new Set<string>();

  // Sort input by createdAtMs desc
  const sortedInput = [...notifs].filter(Boolean).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

  for (const n of sortedInput) {
    if (!n || !n.id) continue;

    // 5-second time bucket to absorb rapid duplicate re-transmissions
    const timeBucket = Math.floor((n.createdAtMs || Date.now()) / 5000);
    const signature = `${n.type || ''}:::${n.title || ''}:::${n.description || ''}:::${timeBucket}`;

    if (map.has(n.id)) {
      const existing = map.get(n.id)!;
      if (existing.read || n.read) {
        map.set(n.id, { ...existing, read: true });
      }
    } else if (!seenRecentSignatures.has(signature)) {
      map.set(n.id, n);
      seenRecentSignatures.add(signature);
    }
  }

  const result = Array.from(map.values());
  result.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
  return result;
}

export default function App() {
  // Keep track of live-subscribed Firestore items for self-healing comparison
  const lastFirestorePostsRef = useRef<Post[]>([]);
  const lastFirestoreUsersRef = useRef<SessionUser[]>([]);

  const [activeCategory, setActiveCategory] = useState('all');
  const [externalSharedText, setExternalSharedText] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isAdminBoardOpen, setIsAdminBoardOpen] = useState(false);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isSystemHealthModalOpen, setIsSystemHealthModalOpen] = useState(false);
  const [isEmergencyAdminModalOpen, setIsEmergencyAdminModalOpen] = useState(false);
  const [showEmergencyAlert, setShowEmergencyAlert] = useState(true);
  const [healthState, setHealthState] = useState<SystemHealthState>(() => systemHealthManager.getState());

  const handleEmergencyLoginSuccess = (adminUser: SessionUser) => {
    setUser(adminUser);
    try {
      localStorage.setItem('mtfeed_user', JSON.stringify(adminUser));
      sessionStorage.setItem('mtfeed_user', JSON.stringify(adminUser));
    } catch (e) {
      console.error(e);
    }
    setSystemToasts(prev => [...prev, {
      id: `toast_emergency_${Date.now()}`,
      type: 'success',
      message: '🚨 เข้าสู่ระบบ Admin ฉุกเฉินสำเร็จ! (Emergency Access Unlocked)',
      submessage: 'สามารถเข้าถึงการตั้งค่าและแอดมินบอร์ดได้ 100% แม้เซิร์ฟเวอร์หลักมีปัญหา'
    }]);
    setIsAdminBoardOpen(true);
  };
  // Interaction Cooldown state
  const lastInteractionRef = useRef<number>(0);
  const [systemToasts, setSystemToasts] = useState<ToastItem[]>([]);

  const isRapidFire = () => {
    const now = Date.now();
    if (now - lastInteractionRef.current < 1000) {
      setSystemToasts(prev => [...prev, {
        id: `toast_${now}`,
        type: 'warning',
        message: 'ระบบกำลังประมวลผล',
        submessage: 'กรุณารอสักครู่...'
      }]);
      setTimeout(() => {
        setSystemToasts(prev => prev.filter(t => t.id !== `toast_${now}`));
      }, 3000);
      return true;
    }
    lastInteractionRef.current = now;
    return false;
  };
  const [viewingProfileUser, setViewingProfileUser] = useState<SessionUser | User | null>(null);
  const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showWelcomeAlert, setShowWelcomeAlert] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(getInitialUser);
  const [sharedPostId, setSharedPostId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('mtfeed_shared_post_id');
  });


  const handleClearSharedPost = () => {
    setSharedPostId(null);
    try {
      sessionStorage.removeItem('mtfeed_shared_post_id');
      if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('post');
        url.searchParams.delete('postId');
        url.searchParams.delete('post_id');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }
    } catch (e) {
      console.error('Error clearing shared post state:', e);
    }
  };

  // Real Registered Users state
  const [registeredUsers, setRegisteredUsers] = useState<SessionUser[]>(() => {
    const list = getAllRegisteredUsersList() || [];
    const currentUser = getInitialUser();
    if (currentUser) {
      const curUName = (currentUser.username || '').toLowerCase();
      const exists = list.some(u => {
        if (!u) return false;
        const uName = (u.username || '').toLowerCase();
        return (curUName && uName === curUName) || (currentUser.uid && u.uid === currentUser.uid);
      });
      if (!exists) list.push(currentUser);
    }
    return list;
  });

  // Real-time synchronization for registered users, posts, and notifications from Firestore & local broadcast
  useEffect(() => {
    // 1. Subscribe to Cloud Firestore Users
    const unsubscribeUsers = subscribeToUsers((firestoreUsers) => {
      if (firestoreUsers) {
        lastFirestoreUsersRef.current = firestoreUsers;
        try {
          const regMap: Record<string, SessionUser> = {};
          
          firestoreUsers.forEach(u => {
            const key = u.uid || u.username || u.id;
            if (key) {
              regMap[key] = u;
              
              // Safe Real-time Hydration: If this is the currently logged in user, 
              // and the remote Firestore profile is newer, sync it to local state & storage!
              const currentUserRaw = localStorage.getItem('mtfeed_user');
              if (currentUserRaw) {
                try {
                  const cur = JSON.parse(currentUserRaw);
                  if (cur && (u.uid === cur.uid || u.username === cur.username)) {
                    const localUpdatedAt = cur.updatedAt || 0;
                    const remoteUpdatedAt = u.updatedAt || 0;
                    
                    if (remoteUpdatedAt > localUpdatedAt) {
                      console.log('Real-time hydrating current user profile from Firestore update');
                      setUser(u);
                      localStorage.setItem('mtfeed_user', JSON.stringify(u));
                      sessionStorage.setItem('mtfeed_user', JSON.stringify(u));
                    }
                  }
                } catch (err) {}
              }
            }
          });

          // Also merge standard default accounts if they don't exist in Firestore
          (Object.values(DEFAULT_ACTIVE_USERS) as SessionUser[]).forEach((defaultUser: SessionUser) => {
            const key = defaultUser.uid || defaultUser.username || defaultUser.id;
            if (key && !regMap[key]) {
              regMap[key] = defaultUser;
            }
          });

          localStorage.setItem('mtfeed_accounts_registry', JSON.stringify(regMap));
          setRegisteredUsers(Object.values(regMap));
        } catch (e) {
          console.error('Error handling firestore users update:', e);
        }
      }
    });

    // 2. Subscribe to Cloud Firestore Posts
    const unsubscribePosts = subscribeToPosts((firestorePosts) => {
      if (firestorePosts !== undefined && firestorePosts !== null) {
        lastFirestorePostsRef.current = firestorePosts;
        setPosts(prevPosts => {
          const merged = mergePostsLists(firestorePosts, prevPosts);
          try {
            localStorage.setItem('mtfeed_posts', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      }
    });

    // 3. Subscribe to Cloud Firestore System Broadcast Notifications
    const unsubscribeSystemNotifs = subscribeToSystemNotifications((systemNotifs) => {
      if (systemNotifs && Array.isArray(systemNotifs) && systemNotifs.length > 0) {
        setNotifications(prev => deduplicateNotifications([...systemNotifs, ...prev]));
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
            setNotifications(deduplicateNotifications(JSON.parse(saved)));
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
      unsubscribeSystemNotifs();
      window.removeEventListener('storage', handleStorageChange);
      if (mtFeedChannel && channelListener) {
        mtFeedChannel.removeEventListener('message', channelListener);
      }
    };
  }, []);

  // System Health Monitoring & Failover Alert Subscription
  useEffect(() => {
    const unsubHealth = systemHealthManager.subscribe((state) => {
      setHealthState(state);
    });

    const unsubToast = systemHealthManager.onToast((toast) => {
      setSystemToasts(prev => [...prev.slice(-2), toast]);
      // Auto dismiss toast after 7 seconds
      setTimeout(() => {
        setSystemToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 7000);
    });

    const unsubNotif = systemHealthManager.onNotification((sysNotif) => {
      setNotifications(prev => deduplicateNotifications([sysNotif, ...prev]));
    });

    return () => {
      unsubHealth();
      unsubToast();
      unsubNotif();
    };
  }, []);

  // Force Full System Self-Healing & Health Check
  const handleForceSyncAll = async () => {
    try {
      console.log('[SELF-HEALING] Running full multi-tier synchronization...');
      await performSheetsSync(true);
      await systemHealthManager.runHealthCheck();
      await systemHealthManager.drainOutbox();
      
      // Also sync latest local posts to firestore if needed
      if (posts.length > 0) {
        await syncPostsToFirestore(posts);
      }
      systemHealthManager.reportFirestoreSuccess();
    } catch (e) {
      console.warn('[SELF-HEALING WARNING]', e);
    }
  };

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

  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);

  useEffect(() => {
    if (posts && posts.length > 0) {
      setHasLoadedInitially(true);
    } else {
      const timer = setTimeout(() => {
        setHasLoadedInitially(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [posts]);

  // 3-Layer Protection: Hydrate user from Firestore
  useEffect(() => {
    async function hydrateUser() {
      if (!user) return;
      const remoteUser = await getUserFromFirestore(user.uid || user.username);
      if (remoteUser) {
        // Compare timestamps
        const localUpdatedAt = user.updatedAt || 0;
        const remoteUpdatedAt = remoteUser.updatedAt || 0;
        
        if (remoteUpdatedAt > localUpdatedAt) {
          console.log('Hydrating user profile from Firestore (newer data found)');
          setUser(remoteUser);
          localStorage.setItem('mtfeed_user', JSON.stringify(remoteUser));
          sessionStorage.setItem('mtfeed_user', JSON.stringify(remoteUser));
        }
      }
    }
    hydrateUser();
  }, []);

  const [isSyncingSheets, setIsSyncingSheets] = useState(false);
  const isSyncingSheetsRef = useRef(false);

  const performSheetsSync = async (isManual = false) => {
    if (isSyncingSheetsRef.current) return;
    isSyncingSheetsRef.current = true;
    if (isManual) setIsSyncingSheets(true);

    try {
      console.log('[GOOGLE SHEETS SYNC] Polling latest changes from Google Sheets...');
      const sheetPosts = await fetchFeedFromGoogleSheets();
      if (sheetPosts && sheetPosts.length > 0) {
        setPosts(prevPosts => {
          const merged = mergePostsLists(sheetPosts, prevPosts);
          try {
            localStorage.setItem('mtfeed_posts', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });

        // Extract registered profiles from sheet posts
        const sheetProfiles = extractProfilesFromSheetPosts(sheetPosts);
        if (sheetProfiles.length > 0) {
          setRegisteredUsers(prev => {
            const regMap: Record<string, SessionUser> = {};
            prev.forEach(u => {
              const key = (u.uid || u.username || u.id || '').toLowerCase();
              if (key) regMap[key] = u;
            });
            sheetProfiles.forEach(sp => {
              const key = (sp.uid || sp.username || sp.id || '').toLowerCase();
              if (key) {
                const existing = regMap[key];
                if (!existing) {
                  regMap[key] = sp;
                } else {
                  // Only update if sheet profile has real data, not placeholder
                  const isPlaceholderName = !sp.name || sp.name === 'MED68001' || sp.name === '#MED68001' || sp.name === 'User';
                  const isDicebearAvatar = !sp.avatar || sp.avatar.includes('api.dicebear.com');
                  const hasCustomExistingAvatar = existing.avatar && (existing.avatar.startsWith('data:image/') || !existing.avatar.includes('api.dicebear.com'));

                  regMap[key] = {
                    ...existing,
                    ...sp,
                    name: sanitizeDisplayName(sp.name || existing.name, key, existing.isAdmin),
                    username: sanitizeUsername(sp.username || existing.username, key, existing.isAdmin),
                    avatar: hasCustomExistingAvatar && isDicebearAvatar ? existing.avatar : (sp.avatar || existing.avatar)
                  };
                }
              }
            });
            const mergedList = Object.values(regMap);
            try {
              localStorage.setItem('mtfeed_accounts_registry', JSON.stringify(regMap));
            } catch (e) {}
            return mergedList;
          });
        }
      }

      // Check current user profile from Google Sheets
      if (user && (user.uid || user.id)) {
        const sheetProfile = await fetchProfileFromGoogleSheets(user.uid || user.id || '');
        if (sheetProfile) {
          setUser(prev => {
            if (!prev) return prev;
            const isSheetDicebear = !sheetProfile.avatar || sheetProfile.avatar.includes('api.dicebear.com');
            const hasCustomLocalAvatar = prev.avatar && (prev.avatar.startsWith('data:image/') || !prev.avatar.includes('api.dicebear.com'));

            const resolvedName = sanitizeDisplayName(sheetProfile.name || prev.name, prev.uid || prev.id, prev.isAdmin);
            const resolvedAvatar = hasCustomLocalAvatar && isSheetDicebear ? prev.avatar : (sheetProfile.avatar || prev.avatar);
            const resolvedUsername = sanitizeUsername(sheetProfile.username || prev.username, prev.uid || prev.id, prev.isAdmin);

            if (resolvedAvatar && !resolvedAvatar.includes('api.dicebear.com')) {
              setExplicitAvatar(prev.uid || prev.id, resolvedAvatar);
            }

            // If local avatar is custom image but Google Sheets is still showing dicebear, sync local custom avatar to Google Sheets
            if (hasCustomLocalAvatar && isSheetDicebear) {
              syncProfileToGoogleSheets({ ...prev, avatar: prev.avatar }).catch(e => console.warn(e));
            }

            if (prev.name !== resolvedName || prev.avatar !== resolvedAvatar || prev.username !== resolvedUsername) {
              console.log('[GOOGLE SHEETS SYNC] User profile updated cleanly:', resolvedName);
              const updated = { 
                ...prev, 
                ...sheetProfile, 
                name: resolvedName, 
                avatar: resolvedAvatar,
                username: resolvedUsername
              };
              try {
                localStorage.setItem('mtfeed_user', JSON.stringify(updated));
                sessionStorage.setItem('mtfeed_user', JSON.stringify(updated));
              } catch (e) {}
              return updated;
            }
            return prev;
          });
        }
      }
    } catch (err) {
      console.warn('[GOOGLE SHEETS SYNC] Sync error:', err);
    } finally {
      isSyncingSheetsRef.current = false;
      if (isManual) {
        setTimeout(() => setIsSyncingSheets(false), 600);
      }
    }
  };

  // Google Sheets Auto-Sync: Periodic background polling (every 30s) & Instant refresh on Tab focus
  useEffect(() => {
    performSheetsSync(false);

    const intervalId = setInterval(() => {
      performSheetsSync(false);
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        performSheetsSync(true);
      }
    };

    const handleFocus = () => {
      performSheetsSync(false);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid]);

  // Tier 1 Google Sheets & Tier 2 SQLite Backup: Load backups on startup and trigger Throttled Self-Healing back-sync
  useEffect(() => {
    let backupPostsList: Post[] = [];
    let backupUsersList: SessionUser[] = [];

    async function loadMultiTierBackups() {
      // A. Load from Tier 1: Permanent Google Sheets Backup
      try {
        console.log('[GOOGLE SHEETS RESTORE] Fetching permanent Google Sheets feed...');
        const sheetPosts = await fetchFeedFromGoogleSheets();
        if (sheetPosts && sheetPosts.length > 0) {
          console.log(`[GOOGLE SHEETS RESTORE] Found ${sheetPosts.length} posts in Google Sheets! Merging...`);
          backupPostsList = [...sheetPosts];
          setPosts(prevPosts => {
            const merged = mergePostsLists(sheetPosts, prevPosts);
            try {
              localStorage.setItem('mtfeed_posts', JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not load backup from Google Sheets:', err);
      }

      // Check current user profile from Google Sheets
      if (user && (user.uid || user.id)) {
        try {
          const sheetProfile = await fetchProfileFromGoogleSheets(user.uid || user.id || '');
          if (sheetProfile) {
            console.log('[GOOGLE SHEETS RESTORE] Found user profile in Google Sheets:', sheetProfile.name);
            setUser(prev => prev ? { ...prev, ...sheetProfile, name: sheetProfile.name || prev.name, avatar: sheetProfile.avatar || prev.avatar } : prev);
          }
        } catch (err) {
          console.warn('Could not load profile from Google Sheets:', err);
        }
      }

      // B. Load from Tier 2: Local SQLite Server Backup
      try {
        console.log('[SQLITE RESTORE] Fetching SQLite posts backup...');
        const sqlitePosts = await getBackupPostsFromSQLite();
        if (sqlitePosts && sqlitePosts.length > 0) {
          backupPostsList = mergePostsLists(sqlitePosts, backupPostsList);
          console.log(`[SQLITE RESTORE] Found ${sqlitePosts.length} posts in SQLite backup. Merging...`);
          setPosts(prevPosts => {
            const merged = mergePostsLists(sqlitePosts, prevPosts);
            try {
              localStorage.setItem('mtfeed_posts', JSON.stringify(merged));
            } catch (e) {}
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not load backup from SQLite:', err);
      }
      
      try {
        console.log('[SQLITE RESTORE] Fetching SQLite users backup...');
        const sqliteUsers = await getBackupUsersFromSQLite();
        if (sqliteUsers && sqliteUsers.length > 0) {
          backupUsersList = sqliteUsers;
          console.log(`[SQLITE RESTORE] Found ${sqliteUsers.length} users in SQLite backup.`);
          // Sync users to registered users state
          setRegisteredUsers(prev => {
            const regMap: Record<string, SessionUser> = {};
            // First load current registered users
            prev.forEach(u => {
              const key = u.uid || u.username || u.id;
              if (key) regMap[key] = u;
            });
            // Merge SQLite users
            sqliteUsers.forEach(u => {
              const key = u.uid || u.username || u.id;
              if (key) {
                const existing = regMap[key];
                if (!existing || (u.updatedAt || 0) > (existing.updatedAt || 0)) {
                  regMap[key] = u;
                  // If this is the currently logged in user, update state too!
                  if (user && (u.uid === user.uid || u.username === user.username)) {
                    if ((u.updatedAt || 0) > (user.updatedAt || 0)) {
                      setUser(u);
                      localStorage.setItem('mtfeed_user', JSON.stringify(u));
                    }
                  }
                }
              }
            });
            const mergedList = Object.values(regMap);
            localStorage.setItem('mtfeed_accounts_registry', JSON.stringify(regMap));
            return mergedList;
          });
        }
      } catch (err) {
        console.warn('Could not load user backups from SQLite:', err);
      }

      // C. Load from Tier 2: Local SQLite Notifications Backup
      try {
        const res = await fetch('/api/backup/notifications');
        if (res.ok) {
          const sqliteNotifs = await res.json();
          if (Array.isArray(sqliteNotifs) && sqliteNotifs.length > 0) {
            console.log(`[SQLITE RESTORE] Found ${sqliteNotifs.length} notifications in SQLite backup.`);
            setNotifications(prev => {
              const map = new Map<string, AppNotification>();
              sqliteNotifs.forEach((n: AppNotification) => {
                if (n && n.id) map.set(n.id, n);
              });
              prev.forEach(n => {
                if (n && n.id && !map.has(n.id)) map.set(n.id, n);
              });
              return Array.from(map.values()).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
            });
          }
        }
      } catch (err) {
        console.warn('Could not load notifications from SQLite backup:', err);
      }

      // Self-Healing Comparison: Check if any items in Google Sheets/SQLite backups are missing in Firestore,
      // and trigger Throttled Back-Sync to Firestore
      setTimeout(() => {
        const firestorePostIds = new Set(lastFirestorePostsRef.current.map(p => p.id));
        const firestoreUserIds = new Set(lastFirestoreUsersRef.current.map(u => u.uid || u.username || u.id));

        const missingPosts = backupPostsList.filter(p => p && p.id && !firestorePostIds.has(p.id));
        const missingUsers = backupUsersList.filter(u => {
          const key = u && (u.uid || u.username || u.id);
          return key && !firestoreUserIds.has(key);
        });

        if (missingPosts.length > 0 || missingUsers.length > 0) {
          console.log(`[SELF-HEALING] Out of sync! Found ${missingPosts.length} posts and ${missingUsers.length} users in backups missing from Firestore.`);
          restoreBackupsToFirestore(missingPosts, missingUsers).catch(err => {
            console.error('[SELF-HEALING ERROR] Backup restoration failed:', err);
          });
        } else {
          console.log('[SELF-HEALING] Firestore is fully in-sync with Google Sheets & SQLite backups! No restoration needed.');
        }
      }, 3500); // 3.5 seconds delay to allow Firestore subscription to settle
    }
    
    loadMultiTierBackups();
  }, []);

  const lastSavedPostsJsonRef = useRef<string>('');
  const lastSavedNotifsJsonRef = useRef<string>('');

  // Save posts to localStorage for offline cache (guarded against loop storms)
  useEffect(() => {
    try {
      const deletedIds = getDeletedPostIds();
      const validPosts = (posts || []).filter(p => p && p.id && !deletedIds.has(p.id));
      const json = JSON.stringify(validPosts);
      if (json !== lastSavedPostsJsonRef.current) {
        lastSavedPostsJsonRef.current = json;
        localStorage.setItem('mtfeed_posts', json);
        if (mtFeedChannel) {
          mtFeedChannel.postMessage({ type: 'POSTS_UPDATED' });
        }
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
        const parsed: AppNotification[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Filter out legacy dummy/mock notifications so users only see real actions & real system welcomes
          const cleaned = parsed.filter(n => {
            if (!n) return false;
            if (n.id === 'notif_2' || n.id === 'notif_3') return false;
            if (typeof n.title === 'string' && (n.title.includes('พี่หมอแล็บใจดี') || n.title.includes('Chem Specialist'))) return false;
            return true;
          });
          return deduplicateNotifications(cleaned);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return deduplicateNotifications(getInitialNotifications(getInitialUser()));
  });

  // Save notifications to localStorage and broadcast (guarded against loop storms)
  useEffect(() => {
    try {
      const json = JSON.stringify(notifications);
      if (json !== lastSavedNotifsJsonRef.current) {
        lastSavedNotifsJsonRef.current = json;
        localStorage.setItem('mtfeed_notifications', json);
        if (mtFeedChannel) {
          mtFeedChannel.postMessage({ type: 'NOTIFICATIONS_UPDATED' });
        }
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
    } else if (typeof window.location.hash === 'string' && window.location.hash.includes('?')) {
      const parts = window.location.hash.split('?');
      if (parts[1]) {
        params = new URLSearchParams(parts[1]);
      }
    }
    
    if (typeof window !== 'undefined') {
      const referrer = document.referrer || '';
      if (
        referrer.includes(MAIN_SITE_HOST) ||
        referrer.includes('mtexam-passalldiwa.ai.studio') || 
        referrer.includes('mt-feed.vercel.app') ||
        referrer.includes('localhost') ||
        referrer.includes('127.0.0.1') ||
        referrer.includes('ai.studio') ||
        referrer.includes('run.app')
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
      ...updatedData,
      updatedAt: Date.now()
    };
    
    // Layer 4: Log changes locally
    try {
      const history = JSON.parse(localStorage.getItem('mtfeed_profile_history') || '[]');
      history.push({ timestamp: Date.now(), changes: updatedData });
      localStorage.setItem('mtfeed_profile_history', JSON.stringify(history));
    } catch (e) {
      console.error('Error logging profile change:', e);
    }

    if (updatedUser.avatar && !updatedUser.avatar.includes('api.dicebear.com')) {
      setExplicitAvatar(updatedUser.uid || updatedUser.id, updatedUser.avatar);
    }

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
        if (!p || !p.author) return p;
        const pAuthorUName = (p.author.username || '').replace(/^@/, '').toLowerCase();
        const userUName = (user?.username || '').replace(/^@/, '').toLowerCase();
        const isAuthor = Boolean(
          (pAuthorUName && userUName && pAuthorUName === userUName) ||
          (p.author.id && user?.uid && p.author.id === user.uid) ||
          (p.author.id && user?.id && p.author.id === user.id)
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
          if (!c || !c.author) return c;
          const cAuthorUName = (c.author.username || '').replace(/^@/, '').toLowerCase();
          const isCommentAuthor = Boolean(
            (cAuthorUName && userUName && cAuthorUName === userUName) ||
            (c.author.id && user?.uid && c.author.id === user.uid)
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
    if (url.includes(MAIN_SITE_HOST) || url.includes('mtexam-passalldiwa.ai.studio')) {
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
    const targetPost = posts.find(p => p && p.id === postId);
    if (targetPost && targetPost.author) {
      const uName = (user?.username || '').replace(/^@/, '').toLowerCase();
      const targetAuthorUName = (targetPost.author.username || '').replace(/^@/, '').toLowerCase();
      const isOwner = Boolean(user && (
        (uName && targetAuthorUName && uName === targetAuthorUName) ||
        (user.uid && targetPost.author.id && user.uid === targetPost.author.id) ||
        (user.id && targetPost.author.id && user.id === targetPost.author.id)
      ));
      const isAdmin = Boolean(user?.isAdmin && !user?.needsAdminVerification);
      if (!isOwner && !isAdmin) {
        alert('❌ คุณไม่มีสิทธิ์ลบโพสต์นี้ (เฉพาะเจ้าของโพสต์หรือ Admin เท่านั้น)');
        return;
      }
    }

    markPostAsDeletedLocally(postId, targetPost?.content, user?.uid || (targetPost?.author as any)?.uid, targetPost);

    setPosts(prev => {
      const targetSig = targetPost ? getPostSignature(targetPost) : '';
      const filtered = prev.filter(p => {
        if (!p || !p.id) return false;
        if (p.id === postId) return false;
        if (targetSig && getPostSignature(p) === targetSig) return false;
        return true;
      });
      try {
        localStorage.setItem('mtfeed_posts', JSON.stringify(filtered));
      } catch (e) {}
      return filtered;
    });
    await deletePostFromFirestore(postId, targetPost?.content, user?.uid || (targetPost?.author as any)?.uid, targetPost);
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
    const cleanTarget = (uidOrUsername || '').toLowerCase();
    const curUName = (user.username || '').toLowerCase();
    if (user && (user.uid === uidOrUsername || (curUName && curUName === cleanTarget))) {
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

  // Admin Broadcast "System & Security" Function
  const handleSendAdminBroadcast = async (broadcast: {
    title: string;
    description: string;
    severity: 'info' | 'warning' | 'alert' | 'success';
    senderType: 'admin' | 'system';
  }) => {
    const newNotif = await sendSystemBroadcastToFirestore(broadcast);
    setNotifications(prev => deduplicateNotifications([newNotif, ...prev]));
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
    if (isRapidFire()) return;
    if (!user && type !== 'reply') {
      window.open(MAIN_SITE_URL, '_blank');
      return;
    }

    const targetPost = posts.find(p => p.id === postId);
    if (targetPost) {
      const newStats = { ...targetPost.stats };
      const newInteractions = { ...(targetPost.userInteractions || {}) };
      let newRepostedBy = [...(targetPost.repostedBy || [])];
      let newRepostedUsers = [...(targetPost.repostedUsers || [])];
      let newLikedBy = [...(targetPost.likedBy || [])];
      let newBookmarkedBy = [...(targetPost.bookmarkedBy || [])];

      if (type === 'like' && user) {
        const hasLiked = newLikedBy.includes(user.uid);
        if (hasLiked) {
          newLikedBy = newLikedBy.filter(uid => uid !== user.uid);
          newInteractions.liked = false;
        } else {
          newLikedBy.push(user.uid);
          newInteractions.liked = true;

          // Dispatch real notification to post author if it's someone else
          if (targetPost.author && targetPost.author.username) {
            const authorUName = targetPost.author.username.replace(/^@/, '').toLowerCase();
            const currentUName = (user.username || '').replace(/^@/, '').toLowerCase();
            if (authorUName && currentUName && authorUName !== currentUName) {
              const nowMs = Date.now();
              const likeNotif: AppNotification = {
                id: `like_${nowMs}_${Math.random().toString(36).substring(2, 7)}`,
                type: 'like',
                title: `${user.name || user.username} ถูกใจโพสต์ของคุณ`,
                description: `มีเพื่อนๆ สนใจโพสต์: "${targetPost.content.slice(0, 50)}${targetPost.content.length > 50 ? '...' : ''}"`,
                authorName: user.name || user.username,
                authorAvatar: user.avatar,
                targetPostId: targetPost.id,
                recipientUsername: authorUName,
                createdAt: formatRealTime(nowMs),
                createdAtMs: nowMs,
                read: false
              };
              setNotifications(prev => [likeNotif, ...prev]);
            }
          }
        }
        newStats.likes = newLikedBy.length;
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
      } else if (type === 'bookmark' && user) {
        const hasBookmarked = newBookmarkedBy.includes(user.uid);
        if (hasBookmarked) {
          newBookmarkedBy = newBookmarkedBy.filter(uid => uid !== user.uid);
          newInteractions.bookmarked = false;
        } else {
          newBookmarkedBy.push(user.uid);
          newInteractions.bookmarked = true;
        }
        newStats.bookmarks = newBookmarkedBy.length;
      }

      const updatedPost: Post = {
        ...targetPost,
        stats: newStats,
        userInteractions: newInteractions,
        repostedBy: newRepostedBy,
        repostedUsers: newRepostedUsers,
        likedBy: newLikedBy,
        bookmarkedBy: newBookmarkedBy
      };

      setPosts(prev => prev.map(p => p.id === postId ? updatedPost : p));
      savePostToFirestore(updatedPost);
    }
  };

  const handleVote = (postId: string, optionId: string) => {
    if (isRapidFire()) return;
    if (!user) {
      window.open(MAIN_SITE_URL, '_blank');
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
    if (isRapidFire()) return;
    if (!user) {
      window.open(MAIN_SITE_URL, '_blank');
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

      // Dispatch real notification to post author if it's someone else
      if (targetPost.author && targetPost.author.username) {
        const authorUName = targetPost.author.username.replace(/^@/, '').toLowerCase();
        const currentUName = (user.username || '').replace(/^@/, '').toLowerCase();
        if (authorUName && currentUName && authorUName !== currentUName) {
          const commentNotif: AppNotification = {
            id: `comment_${nowMs}_${Math.random().toString(36).substring(2, 7)}`,
            type: 'comment',
            title: `${user.name || user.username} แสดงความคิดเห็นในโพสต์ของคุณ`,
            description: `"${content.slice(0, 60)}${content.length > 60 ? '...' : ''}"`,
            authorName: user.name || user.username,
            authorAvatar: user.avatar,
            targetPostId: targetPost.id,
            recipientUsername: authorUName,
            createdAt: formatRealTime(nowMs),
            createdAtMs: nowMs,
            read: false
          };
          setNotifications(prev => [commentNotif, ...prev]);
        }
      }
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
    const uName = (user.username || '').toLowerCase();
    const uUid = (user.uid || '').toLowerCase();
    const target = (n.recipientUsername || '').toLowerCase();
    return (uName && target === uName) || (uUid && target === uUid);
  });

  const unreadNotificationsCount = relevantNotifications.filter(n => !n.read).length;

  const mappedPosts = React.useMemo(() => {
    return (posts || []).filter(Boolean).map(post => {
      const isLiked = Boolean(user?.uid && (post.likedBy || []).includes(user.uid));
      const isBookmarked = Boolean(user?.uid && (post.bookmarkedBy || []).includes(user.uid));
      const isReposted = Boolean(
        user?.username && (post.repostedBy || []).some((username: string) => (username || '').toLowerCase() === (user.username || '').toLowerCase())
      );
      
      return {
        ...post,
        userInteractions: {
          ...post.userInteractions,
          liked: isLiked,
          bookmarked: isBookmarked,
          reposted: isReposted
        }
      };
    });
  }, [posts, user]);

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
            href={MAIN_SITE_URL}
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
              เข้าสู่ระบบด้วยรหัสปลอดภัย 8 หลัก: <b>{user.name || user.username}</b>{!(user.isAdmin || user.badge === '👑 Admin') && ` (@${user.username})`} • 
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

      {/* Emergency Admin Bypass Banner */}
      {user?.isEmergencyAdmin && showEmergencyAlert && (
        <div className="bg-gradient-to-r from-red-700 via-rose-800 to-red-900 text-white text-xs font-bold py-2 px-4 flex items-center justify-between shadow-md border-b border-red-600">
          <div className="flex items-center space-x-2 max-w-7xl mx-auto w-full">
            <span className="bg-yellow-400 text-red-950 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider animate-pulse flex-shrink-0">
              Emergency Bypass Active
            </span>
            <span className="flex-1 truncate">🚨 โหมดแอดมินฉุกเฉิน (Bypass Mode) — ปลดล็อกสิทธิ์แอดมิน 100% สำหรับเข้าตั้งค่าและดูแลระบบ</span>
            <button
              onClick={() => setShowEmergencyAlert(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors ml-2 flex-shrink-0"
              title="ปิดการแจ้งเตือนนี้"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <Navbar 
        user={user} 
        onLoginClick={() => window.open(MAIN_SITE_URL, '_blank')} 
        onAdminClick={() => setIsAdminBoardOpen(true)}
        onEditProfileClick={() => user ? setIsEditProfileOpen(true) : window.open(MAIN_SITE_URL, '_blank')}
        onViewProfile={handleViewProfile}
        onLogoutClick={handleLogout}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        unreadCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsModalOpen(true)}
        onExternalLinkClick={handleOpenExternalUrl}
        isSyncingSheets={isSyncingSheets}
        onRefreshSheets={() => performSheetsSync(true)}
        healthState={healthState}
        onOpenSystemHealth={() => setIsSystemHealthModalOpen(true)}
        onOpenEmergencyAdmin={() => setIsEmergencyAdminModalOpen(true)}
      />
      
      {sharedPostId ? (
        <div className="min-h-screen bg-gray-50 pb-20">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100 px-4 py-4 sticky top-16 z-10 shadow-sm">
            <div className="max-w-2xl mx-auto flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xl">📌</span>
                <div>
                  <h2 className="text-sm font-bold text-gray-900 animate-pulse">โพสต์ที่เชื่อมโยงมา (Shared Post)</h2>
                  <p className="text-xs text-gray-500">คุณกำลังดูโพสต์นี้ในโหมดอ่านอย่างเดียว</p>
                </div>
              </div>
              <button
                onClick={handleClearSharedPost}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-bold transition-colors shadow-sm flex items-center space-x-1"
              >
                <span>🏠 เข้าสู่หน้าหลัก MT Feed</span>
              </button>
            </div>
          </div>

          <div className="max-w-2xl mx-auto px-4 py-6">
            {!hasLoadedInitially && posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mb-4"></div>
                <p className="text-sm text-gray-500 font-medium">กำลังโหลดโพสต์ที่แชร์มา...</p>
              </div>
            ) : (() => {
              const sharedPost = mappedPosts.find(p => p.id === sharedPostId);
              if (!sharedPost) {
                return (
                  <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
                    <span className="text-4xl">🔍</span>
                    <h3 className="text-lg font-bold text-gray-900 mt-4 mb-2">ไม่พบโพสต์ที่คุณตามหา</h3>
                    <p className="text-sm text-gray-500 mb-6">โพสต์นี้อาจจะไม่มีอยู่จริง หรือถูกลบโดยผู้เขียน/ผู้ดูแลระบบไปแล้ว</p>
                    <button
                      onClick={handleClearSharedPost}
                      className="px-6 py-2.5 bg-red-600 text-white rounded-full text-sm font-bold hover:bg-red-700 transition-colors shadow"
                    >
                      เข้าสู่หน้าฟีดหลัก MT Feed
                    </button>
                  </div>
                );
              }
              return (
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                    <PostItem
                      post={sharedPost}
                      user={user}
                      onInteraction={handleInteraction}
                      onVote={handleVote}
                      onComment={handleComment}
                      onDelete={handleDeletePost}
                      onReport={handleReportPost}
                      onProfileClick={handleViewProfile}
                      onSelectTag={(tag) => {
                        setSelectedTag(tag);
                        handleClearSharedPost();
                      }}
                      onExternalLinkClick={handleOpenExternalUrl}
                      readOnly={true}
                    />
                  </div>

                  <div className="text-center bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                    <h3 className="text-base font-bold text-gray-900 mb-2">สนใจอ่านเรื่องราวอื่นๆ เพิ่มเติมหรือไม่?</h3>
                    <p className="text-sm text-gray-500 mb-4 font-normal">เข้าสู่ระบบผ่านเว็บไซต์หลัก เพื่อร่วมพูดคุย แสดงความคิดเห็น โหวตโพล และติดตามฟีดข้อมูลแบบเรียลไทม์</p>
                    <button
                      onClick={handleClearSharedPost}
                      className="inline-flex items-center space-x-1 px-6 py-2.5 bg-gray-950 text-white rounded-full text-sm font-bold hover:bg-gray-800 transition-all shadow"
                    >
                      <span>สำรวจหน้าฟีดหลัก MT Feed ➔</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      ) : (
        <>
          <main className="max-w-7xl mx-auto flex justify-center lg:justify-between px-0 sm:px-4 lg:px-8">
            <SidebarLeft 
              activeCategory={activeCategory} 
              setActiveCategory={(cat) => {
                setActiveCategory(cat);
                setSelectedTag(null);
              }}
              unreadCount={unreadNotificationsCount}
              onOpenNotifications={() => setIsNotificationsModalOpen(true)}
              onEditProfileClick={() => user ? setIsEditProfileOpen(true) : window.open(MAIN_SITE_URL, '_blank')}
              onViewProfile={handleViewProfile}
              onLogoutClick={handleLogout}
              currentUser={user}
            />
            
            <Feed 
              posts={mappedPosts}
              setPosts={setPosts}
              activeCategory={activeCategory} 
              user={user} 
              onLoginClick={() => window.open(MAIN_SITE_URL, '_blank')} 
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
              posts={mappedPosts}
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
                href={MAIN_SITE_URL} 
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenExternalUrl(MAIN_SITE_URL);
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
                onClick={() => user ? handleViewProfile(user) : window.open(MAIN_SITE_URL, '_blank')} 
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
        </>
      )}

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
        onOpenEmergencyAdmin={() => setIsEmergencyAdminModalOpen(true)}
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
          allPosts={mappedPosts}
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
          } else if (notif.targetPostId) {
            setSelectedTag('ทั้งหมด');
            setIsNotificationsModalOpen(false);
            setTimeout(() => {
              const el = document.getElementById(notif.targetPostId!);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-red-400');
                setTimeout(() => el.classList.remove('ring-2', 'ring-red-400'), 2500);
              }
            }, 200);
          }
        }}
        user={user}
        onOpenAdminBroadcast={() => {
          setIsNotificationsModalOpen(false);
          setIsAdminBoardOpen(true);
        }}
      />

      <AdminBoardModal 
        isOpen={isAdminBoardOpen} 
        onClose={() => setIsAdminBoardOpen(false)} 
        posts={mappedPosts} 
        onDeletePost={handleDeletePost}
        registeredUsers={registeredUsers}
        onDeleteUser={handleDeleteUser}
        onClearAllUsers={handleClearAllUsers}
        currentUser={user}
        onSendBroadcast={handleSendAdminBroadcast}
        onOpenSystemHealth={() => {
          setIsAdminBoardOpen(false);
          setIsSystemHealthModalOpen(true);
        }}
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

      {/* System Health & Multi-tier Failover Monitor Modal */}
      <SystemHealthModal
        isOpen={isSystemHealthModalOpen}
        onClose={() => setIsSystemHealthModalOpen(false)}
        healthState={healthState}
        onForceSyncAll={handleForceSyncAll}
        onOpenEmergencyAdmin={() => setIsEmergencyAdminModalOpen(true)}
      />

      {/* Emergency Admin Passcode Verification Modal */}
      <EmergencyAdminModal
        isOpen={isEmergencyAdminModalOpen}
        onClose={() => setIsEmergencyAdminModalOpen(false)}
        onEmergencyLoginSuccess={handleEmergencyLoginSuccess}
      />

      {/* Real-time System Resilience Toast Container (Admin Only) */}
      {user?.isAdmin && (
        <SystemToastContainer
          toasts={systemToasts}
          onDismiss={(id) => {
            setSystemToasts(prev => prev.filter(t => t.id !== id));
          }}
          onOpenSystemHealth={() => setIsSystemHealthModalOpen(true)}
        />
      )}
    </div>
  );
}
