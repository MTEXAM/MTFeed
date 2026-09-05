import React, { useState, useMemo } from 'react';
import { 
  X, 
  ArrowLeft, 
  Repeat2, 
  MessageCircle, 
  Heart, 
  Bookmark, 
  Shield, 
  Calendar, 
  School, 
  Building2, 
  Edit3, 
  Share2, 
  Search, 
  Sparkles, 
  FileText, 
  Image as ImageIcon,
  AtSign,
  Check,
  UserCheck
} from 'lucide-react';
import { Post, User, SessionUser } from '../types';
import { PostItem } from './PostItem';
import { getBadgeStyle, formatUserBadge, maskUid, sanitizeDisplayName, sanitizeUsername } from '../utils/auth';

export function UserProfileModal({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  allPosts = [],
  onInteraction,
  onVote,
  onComment,
  onDelete,
  onReport,
  onSelectTag,
  onExternalLinkClick,
  onEditProfileClick,
  onMentionUserInPost,
  onSelectAnotherProfile
}: {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | SessionUser | null;
  currentUser: SessionUser | null;
  allPosts: Post[];
  onInteraction: (postId: string, type: 'reply' | 'repost' | 'like' | 'bookmark') => void;
  onVote: (postId: string, optionId: string) => void;
  onComment?: (postId: string, content: string) => void;
  onDelete?: (postId: string) => void;
  onReport?: (postId: string) => void;
  onSelectTag?: (tag: string) => void;
  onExternalLinkClick?: (url: string) => void;
  onEditProfileClick?: () => void;
  onMentionUserInPost?: (username: string) => void;
  onSelectAnotherProfile?: (user: User) => void;
}) {
  const [activeTab, setActiveTab] = useState<'all' | 'posts' | 'reposts' | 'media'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  
  const isTargetAdmin = Boolean(targetUser?.isAdmin || targetUser?.badge === '👑 Admin' || (targetUser as any)?.uid === 'MED68001' || (targetUser as any)?.id === 'MED68001');
  const displayUsername = sanitizeUsername(targetUser?.username, (targetUser as any)?.uid || (targetUser as any)?.id, isTargetAdmin);
  const displayName = sanitizeDisplayName(targetUser?.name, (targetUser as any)?.uid || (targetUser as any)?.id, isTargetAdmin);

  const rawUsername = targetUser?.username || '';
  const targetUsername = rawUsername.replace(/^@/, '').toLowerCase();
  const targetUid = (targetUser as SessionUser)?.uid || (targetUser as any)?.id || '';
  const currentUsername = (currentUser?.username || '').replace(/^@/, '').toLowerCase();
  const currentUid = currentUser?.uid || (currentUser as any)?.id || '';

  const isSelf = Boolean(
    currentUser && targetUser && (
      (currentUsername && targetUsername && currentUsername === targetUsername) ||
      (currentUid && targetUid && currentUid === targetUid)
    )
  );

  // Filter authored posts
  const authoredPosts = useMemo(() => {
    if (!targetUser || !Array.isArray(allPosts)) return [];
    return allPosts.filter(p => {
      if (!p || !p.author) return false;
      const authorUsername = (p.author.username || '').replace(/^@/, '').toLowerCase();
      const authorId = p.author.id || (p.author as any).uid || '';
      return (
        (targetUsername && authorUsername === targetUsername) ||
        (targetUid && authorId === targetUid)
      );
    });
  }, [allPosts, targetUsername, targetUid, targetUser]);

  // Filter reposted posts
  const repostedPosts = useMemo(() => {
    if (!targetUser || !Array.isArray(allPosts)) return [];
    return allPosts.filter(p => {
      if (!p) return false;
      // Check if user has reposted this post
      const isRepostedByUser = (
        (Array.isArray(p.repostedBy) && p.repostedBy.some(u => (u || '').replace(/^@/, '').toLowerCase() === targetUsername)) ||
        (Array.isArray(p.repostedUsers) && p.repostedUsers.some(u => (u.username || '').replace(/^@/, '').toLowerCase() === targetUsername || (targetUid && u.uid === targetUid))) ||
        (isSelf && p.userInteractions?.reposted)
      );
      return Boolean(isRepostedByUser);
    });
  }, [allPosts, targetUsername, targetUid, isSelf, targetUser]);

  // Total Likes received on authored posts
  const totalLikesReceived = useMemo(() => {
    return authoredPosts.reduce((acc, p) => acc + (p?.stats?.likes || 0), 0);
  }, [authoredPosts]);

  // Total Comments made by this user across all posts
  const totalCommentsCount = useMemo(() => {
    if (!targetUser || !Array.isArray(allPosts)) return 0;
    let count = 0;
    allPosts.forEach(p => {
      if (!p || !Array.isArray(p.comments)) return;
      p.comments.forEach(c => {
        if (!c || !c.author) return;
        const cUsername = (c.author.username || '').replace(/^@/, '').toLowerCase();
        const cId = c.author.id || (c.author as any).uid || '';
        if ((targetUsername && cUsername === targetUsername) || (targetUid && cId === targetUid)) {
          count++;
        }
      });
    });
    return count;
  }, [allPosts, targetUsername, targetUid, targetUser]);

  // Combined posts according to active tab
  const displayPosts = useMemo(() => {
    let list: { post: Post; isRepost: boolean }[] = [];

    if (activeTab === 'all') {
      // Authored posts
      authoredPosts.forEach(p => {
        if (p) list.push({ post: p, isRepost: false });
      });
      // Reposted posts (avoid duplicating if user authored and also reposted)
      repostedPosts.forEach(p => {
        if (p && !authoredPosts.some(ap => ap?.id === p.id)) {
          list.push({ post: p, isRepost: true });
        }
      });
      // Sort by newest createdAtMs or fallback
      list.sort((a, b) => (b.post?.createdAtMs || 0) - (a.post?.createdAtMs || 0));
    } else if (activeTab === 'posts') {
      list = authoredPosts.map(p => ({ post: p, isRepost: false }));
    } else if (activeTab === 'reposts') {
      list = repostedPosts.map(p => ({ post: p, isRepost: true }));
    } else if (activeTab === 'media') {
      list = authoredPosts
        .filter(p => Boolean(p?.image))
        .map(p => ({ post: p, isRepost: false }));
    }

    if (searchQuery && String(searchQuery).trim()) {
      const q = String(searchQuery).toLowerCase().trim();
      list = list.filter(item => 
        (item.post?.content && String(item.post.content).toLowerCase().includes(q)) ||
        (Array.isArray(item.post?.tags) && item.post.tags.some(t => String(t || '').toLowerCase().includes(q)))
      );
    }

    return list;
  }, [activeTab, authoredPosts, repostedPosts, searchQuery]);

  if (!isOpen || !targetUser) return null;

  // Default avatar fallback
  const displayAvatar = targetUser.avatar || (
    targetUser.isAdmin 
      ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5'
      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(rawUsername || 'User')}&backgroundColor=cccccc`
  );

  const badgeText = formatUserBadge(targetUser as any);
  const badgeStyle = getBadgeStyle(badgeText);

  const handleCopyProfileLink = () => {
    const url = `https://mt-feed.vercel.app/?user=@${targetUsername}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleMention = () => {
    if (onMentionUserInPost) {
      onMentionUserInPost(`@${displayUsername}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150 my-4 max-h-[92vh] flex flex-col">
        
        {/* Top bar header with banner */}
        <div className="relative bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 pt-12 pb-14 px-6 text-white flex-shrink-0">
          <div className="absolute top-3 left-3 right-3 flex justify-between items-center z-10">
            <button
              onClick={onClose}
              className="p-1.5 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-xs transition-colors cursor-pointer"
              title="ปิด"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyProfileLink}
                className="p-1.5 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                title="คัดลอกลิงก์โปรไฟล์"
              >
                {copiedLink ? <Check className="w-4 h-4 text-green-300" /> : <Share2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-xs transition-colors cursor-pointer"
                title="ปิด"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Profile Card Header Info */}
        <div className="px-6 pb-4 pt-0 relative bg-white border-b border-gray-100 flex-shrink-0">
          {/* Avatar and Action Button */}
          <div className="flex justify-between items-end -mt-10 mb-3">
            <div className="relative">
              <img
                src={displayAvatar}
                alt={displayName}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-white shadow-md bg-white"
              />
              {targetUser.isAdmin && (
                <span className="absolute bottom-0 right-0 bg-red-600 text-white p-1 rounded-full border-2 border-white shadow-xs" title="ผู้ดูแลระบบ">
                  <Shield className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            <div className="flex space-x-2">
              {isSelf ? (
                <button
                  onClick={() => {
                    onClose();
                    onEditProfileClick?.();
                  }}
                  className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 mr-1.5" />
                  แก้ไขโปรไฟล์
                </button>
              ) : (
                <button
                  onClick={handleMention}
                  className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <AtSign className="w-3.5 h-3.5 mr-1" />
                  แท็กในโพสต์
                </button>
              )}
            </div>
          </div>

          {/* Name, Username, Badges */}
          <div className="space-y-1">
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">
                {displayName}
              </h2>
              {badgeText && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                  {badgeText}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 text-xs text-gray-500 flex-wrap">
              <span className="font-semibold text-gray-700">@{displayUsername}</span>
            </div>


          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-2 pt-4 mt-3 border-t border-gray-100 text-center">
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-base sm:text-lg font-bold text-gray-900">{authoredPosts.length}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium">โพสต์</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-base sm:text-lg font-bold text-gray-900">{repostedPosts.length}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium">รีโพสต์</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-base sm:text-lg font-bold text-gray-900">{totalCommentsCount}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium">ตอบกลับ</p>
            </div>
            <div className="p-2 bg-gray-50 rounded-xl">
              <p className="text-base sm:text-lg font-bold text-red-600">{totalLikesReceived}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 font-medium">ถูกใจที่ได้รับ</p>
            </div>
          </div>

          {/* Search bar within profile */}
          <div className="mt-3 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-3.5 w-3.5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`ค้นหาในโพสต์ของ @${displayUsername}...`}
              className="block w-full pl-9 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-1 focus:ring-red-500 focus:bg-white transition-all outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mt-3 -mb-4 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
                activeTab === 'all'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <span>ทั้งหมด</span>
              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {authoredPosts.length + repostedPosts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('posts')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
                activeTab === 'posts'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <FileText className="w-3.5 h-3.5 mr-0.5" />
              <span>โพสต์</span>
              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {authoredPosts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('reposts')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
                activeTab === 'reposts'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Repeat2 className="w-3.5 h-3.5 mr-0.5" />
              <span>รีโพสต์</span>
              <span className="bg-gray-100 text-gray-600 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {repostedPosts.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-2.5 text-center border-b-2 transition-colors cursor-pointer flex items-center justify-center space-x-1 ${
                activeTab === 'media'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 mr-0.5" />
              <span>รูปภาพ</span>
            </button>
          </div>
        </div>

        {/* Scrollable Feed List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 bg-gray-50/40">
          {displayPosts.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                {activeTab === 'reposts' ? <Repeat2 className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
              </div>
              <p className="text-sm font-bold text-gray-700">
                {searchQuery ? 'ไม่พบโพสต์ที่ตรงกับคำค้นหา' : 'ยังไม่มีโพสต์ในหมวดนี้'}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {searchQuery 
                  ? 'ลองใช้คำค้นหาอื่นดูสิ'
                  : activeTab === 'reposts' 
                    ? `${isTargetAdmin ? '👑 Admin' : `@${displayUsername}`} ยังไม่ได้รีโพสต์ข้อความใด` 
                    : `${isTargetAdmin ? '👑 Admin' : `@${displayUsername}`} ยังไม่ได้สร้างโพสต์ในส่วนนี้`}
              </p>
            </div>
          ) : (
            displayPosts.map(({ post, isRepost }) => (
              <div key={`${post.id}_${isRepost ? 'repost' : 'post'}`} className="bg-white">
                {isRepost && (
                  <div className="flex items-center px-4 pt-3 text-xs text-gray-500 font-semibold bg-gray-50/60 border-b border-gray-100/60">
                    <Repeat2 className="w-3.5 h-3.5 mr-1.5 text-green-600" />
                    <span>{isTargetAdmin ? '👑 Admin' : `@${displayUsername}`} ได้รีโพสต์</span>
                  </div>
                )}
                <PostItem
                  post={post}
                  onInteraction={onInteraction}
                  onVote={onVote}
                  onComment={onComment}
                  onDelete={onDelete}
                  onReport={onReport}
                  user={currentUser}
                  onSelectTag={(tag) => {
                    onClose();
                    onSelectTag?.(tag);
                  }}
                  onExternalLinkClick={onExternalLinkClick}
                  onProfileClick={(clickedUser) => {
                    if (onSelectAnotherProfile) {
                      onSelectAnotherProfile(clickedUser);
                    }
                  }}
                />
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
