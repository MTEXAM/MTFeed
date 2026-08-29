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
import { ProfileEditModal } from './components/ProfileEditModal';
import { MessageSquare, Search, Bell, BookA, User as UserIcon, CheckCircle2, X, ShieldCheck } from 'lucide-react';
import { SessionUser, AppNotification, Post } from './types';
import { resolveUserAccount, getInitialNotifications, getRegisteredUsers, getAllRegisteredUsersList, deleteRegisteredUser } from './utils/auth';
import { INITIAL_POSTS } from './data';

// Helper function to extract user from URL search params, hash, or localStorage synchronously
function getInitialUser(): SessionUser | null {
  try {
    let params: URLSearchParams | null = null;
    if (window.location.search) {
      params = new URLSearchParams(window.location.search);
    } else if (window.location.hash && window.location.hash.includes('?')) {
      params = new URLSearchParams(window.location.hash.split('?')[1]);
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

      if (usernameParam) {
        const autoUser = resolveUserAccount({
          username: usernameParam,
          uidParam,
          displayName: displayNameParam,
          avatar: avatarParam,
          role: roleParam,
          userGroupParam,
          academicYearParam,
          facultyParam,
          universityParam
        });

        try {
          localStorage.setItem('mtfeed_user', JSON.stringify(autoUser));
        } catch (e) {
          console.error('Error saving user to localStorage:', e);
        }

        return autoUser;
      }
    }

    // Check localStorage if not in URL
    const savedUser = localStorage.getItem('mtfeed_user');
    if (savedUser) {
      return JSON.parse(savedUser);
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
  const [isAdminBoardOpen, setIsAdminBoardOpen] = useState(false);
  const [isOnlineModalOpen, setIsOnlineModalOpen] = useState(false);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
  const [isProfileEditModalOpen, setIsProfileEditModalOpen] = useState(false);
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

  // Global Posts State
  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem('mtfeed_posts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_POSTS;
      }
    }
    return INITIAL_POSTS;
  });

  // Save posts to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mtfeed_posts', JSON.stringify(posts));
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

  // Save notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('mtfeed_notifications', JSON.stringify(notifications));
    } catch (e) {
      console.error(e);
    }
  }, [notifications]);

  useEffect(() => {
    // Check if user came with URL params just now
    let params: URLSearchParams | null = null;
    if (window.location.search) {
      params = new URLSearchParams(window.location.search);
    } else if (window.location.hash && window.location.hash.includes('?')) {
      params = new URLSearchParams(window.location.hash.split('?')[1]);
    }

    if (params) {
      const usernameParam = params.get('username') || params.get('user') || params.get('u') || params.get('student_name') || params.get('name') || params.get('id');
      const shareText = params.get('share_text') || params.get('text') || params.get('q');
      
      if (usernameParam) {
        setShowWelcomeAlert(true);
        const timer = setTimeout(() => setShowWelcomeAlert(false), 7000);
        return () => clearTimeout(timer);
      }

      if (shareText) {
        setExternalSharedText(decodeURIComponent(shareText));
      }
    }
  }, []);

  const handleLogin = (username: string, isAdmin: boolean) => {
    const userData = resolveUserAccount({
      username,
      role: isAdmin ? 'admin' : undefined
    });
    setUser(userData);
    setRegisteredUsers(getAllRegisteredUsersList());
    try {
      localStorage.setItem('mtfeed_user', JSON.stringify(userData));
    } catch (e) {
      console.error(e);
    }
  };

  const handleProfileUpdate = (updatedUser: SessionUser) => {
    setUser(updatedUser);
    setRegisteredUsers(getAllRegisteredUsersList());
    try {
      localStorage.setItem('mtfeed_user', JSON.stringify(updatedUser));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    setUser(null);
    try {
      localStorage.removeItem('mtfeed_user');
    } catch (e) {
      console.error(e);
    }
  };

  // Admin Delete User Function
  const handleDeleteUser = (uidOrUsername: string) => {
    deleteRegisteredUser(uidOrUsername);
    const updatedUsers = getAllRegisteredUsersList();
    setRegisteredUsers(updatedUsers);

    // If current logged-in user was deleted, log out
    if (user && (user.uid === uidOrUsername || user.username.toLowerCase() === uidOrUsername.toLowerCase())) {
      handleLogout();
    }
  };

  // Trigger @mention notification
  const handleMentionNotification = (mentionData: {
    recipientUsername: string;
    authorName: string;
    authorAvatar?: string;
    contentPreview: string;
    targetPostId?: string;
  }) => {
    const newNotif: AppNotification = {
      id: `mention_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'mention',
      title: `@${mentionData.authorName} ได้กล่าวถึงคุณในโพสต์`,
      description: mentionData.contentPreview.length > 90 ? mentionData.contentPreview.slice(0, 90) + '...' : mentionData.contentPreview,
      authorName: mentionData.authorName,
      authorAvatar: mentionData.authorAvatar,
      targetPostId: mentionData.targetPostId,
      recipientUsername: mentionData.recipientUsername.toLowerCase(),
      createdAt: 'เมื่อสักครู่',
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

  // Notifications relevant for current user:
  // - System notifications (no recipientUsername)
  // - OR notifications specifically targeting this user's username / UID
  const relevantNotifications = notifications.filter(n => {
    if (!n.recipientUsername) return true; // public system notifications
    if (!user) return false;
    return n.recipientUsername === user.username.toLowerCase() || n.recipientUsername === user.uid.toLowerCase();
  });

  const unreadNotificationsCount = relevantNotifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-white">
      {/* Welcome Banner when connected */}
      {showWelcomeAlert && user && (
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 text-white px-4 py-2.5 shadow-md flex items-center justify-between text-sm sticky top-0 z-50 animate-fadeIn">
          <div className="flex items-center space-x-2 max-w-5xl mx-auto flex-1">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-yellow-300" />
            <span className="font-medium truncate">
              เข้าสู่ระบบด้วยรหัสปลอดภัย 8 หลัก: <b>{user.name || user.username}</b> (@{user.username}) • 
              <span className="ml-1 font-mono bg-white/25 px-2 py-0.5 rounded text-xs">UID: #{user.uid}</span>
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
        onLoginClick={() => setIsAuthModalOpen(true)} 
        onAdminClick={() => setIsAdminBoardOpen(true)}
        onEditProfile={() => setIsProfileEditModalOpen(true)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        unreadCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationsModalOpen(true)}
        onExternalLinkClick={(url) => setPendingExternalUrl(url)}
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
          currentUser={user}
          onEditProfile={() => setIsProfileEditModalOpen(true)}
        />
        
        <Feed 
          posts={posts}
          setPosts={setPosts}
          activeCategory={activeCategory} 
          user={user} 
          onLoginClick={() => setIsAuthModalOpen(true)} 
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
          onExternalLinkClick={(url) => setPendingExternalUrl(url)}
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
              setPendingExternalUrl('https://mtexam-passalldiwa.ai.studio/');
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
            onClick={() => !user ? setIsAuthModalOpen(true) : undefined} 
            className="p-2 text-gray-500 hover:text-gray-900 transition-colors flex flex-col items-center"
            title={user ? `@${user.username}` : "เข้าสู่ระบบ"}
          >
            <UserIcon className={`w-6 h-6 ${user ? 'text-red-600' : ''}`} />
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

      <OnlineMembersModal 
        isOpen={isOnlineModalOpen}
        onClose={() => setIsOnlineModalOpen(false)}
        currentUser={user}
        registeredUsers={registeredUsers}
        onDeleteUser={handleDeleteUser}
        onSelectUserForPost={(mention) => {
          setExternalSharedText(mention);
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
        onDeletePost={(postId) => setPosts(prev => prev.filter(p => p.id !== postId))}
        registeredUsers={registeredUsers}
        onDeleteUser={handleDeleteUser}
        currentUser={user}
      />

      <ProfileEditModal
        isOpen={isProfileEditModalOpen}
        onClose={() => setIsProfileEditModalOpen(false)}
        user={user}
        onUpdateUser={handleProfileUpdate}
      />
    </div>
  );
}
