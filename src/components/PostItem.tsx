import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Repeat2, Heart, Bookmark, Share, Send, MoreHorizontal, Trash2, Flag, ExternalLink } from 'lucide-react';
import { Post } from '../types';
import { getBadgeStyle } from '../utils/auth';
import { formatRelativeOrRealTime, formatFullDateTime } from '../utils/timeUtils';

export function PostItem({ 
  post, 
  onInteraction,
  onVote,
  onComment,
  onDelete,
  onReport,
  user,
  onSelectTag,
  onExternalLinkClick,
  onProfileClick
}: { 
  post: Post;
  onInteraction: (postId: string, type: 'reply' | 'repost' | 'like' | 'bookmark') => void;
  onVote: (postId: string, optionId: string) => void;
  onComment?: (postId: string, content: string) => void;
  onDelete?: (postId: string) => void;
  onReport?: (postId: string) => void;
  user: { username: string; isAdmin: boolean; needsAdminVerification?: boolean; uid?: string; id?: string; name?: string; avatar?: string } | null;
  onSelectTag?: (tag: string) => void;
  onExternalLinkClick?: (url: string) => void;
  onProfileClick?: (user: any) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isLiked = post.userInteractions?.liked;
  const isReposted = post.userInteractions?.reposted;
  const isBookmarked = post.userInteractions?.bookmarked;
  const votedOptionId = post.userInteractions?.votedOptionId;

  const currentUser = user as any;
  const authorName = post?.author?.name || post?.author?.username || 'ผู้ใช้งาน';
  const authorUsername = post?.author?.username || '';
  const authorAvatar = post?.author?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(authorUsername || 'user')}&backgroundColor=cccccc`;
  const authorId = post?.author?.id || (post?.author as any)?.uid || '';

  const isOwner = Boolean(currentUser && (
    (currentUser.username && authorUsername && currentUser.username.replace(/^@/, '').toLowerCase() === authorUsername.replace(/^@/, '').toLowerCase()) ||
    (currentUser.uid && authorId && currentUser.uid === authorId) ||
    (currentUser.id && authorId && currentUser.id === authorId)
  ));
  const isVerifiedAdmin = Boolean(user?.isAdmin && !user?.needsAdminVerification);
  const canDelete = isVerifiedAdmin || isOwner;
  const canReport = Boolean(user && !isOwner && !isVerifiedAdmin);

  const stats = {
    replies: post?.stats?.replies || (Array.isArray(post?.comments) ? post.comments.length : 0),
    reposts: post?.stats?.reposts || 0,
    likes: post?.stats?.likes || 0,
    bookmarks: post?.stats?.bookmarks || 0,
  };

  const tags = Array.isArray(post?.tags) ? post.tags : [];

  const handleShare = async () => {
    const shareData = {
      title: 'MT Feed - ' + authorName,
      text: post?.content || '',
      url: 'https://mt-feed.vercel.app',
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      navigator.clipboard.writeText(`${shareData.title}\n\n${shareData.text}\n\n${shareData.url}`);
      alert('คัดลอกลิงก์โพสต์เรียบร้อยแล้ว');
    }
  };

  const handleReplyClick = () => {
    setShowComments(!showComments);
    // Also trigger interaction if it's the first time
    if (!showComments) {
      onInteraction(post.id, 'reply');
    }
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    
    if (onComment) {
      onComment(post.id, commentText);
      setCommentText('');
    }
  };

  const renderContentWithLinks = (text: string) => {
    // Regex for URLs, hashtags, and mentions
    const tokenRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|#[\w\u0E00-\u0E7F]+|@[\w\u0E00-\u0E7F]+)/g;
    return text.split(tokenRegex).map((part, i) => {
      const isUrl = part.startsWith('http://') || part.startsWith('https://') || part.startsWith('www.');
      if (isUrl) {
        const fullUrl = part.startsWith('www.') ? `https://${part}` : part;
        return (
          <a 
            key={i} 
            href={fullUrl} 
            className="text-red-600 hover:text-red-700 underline font-medium inline-flex items-center space-x-0.5 break-all hover:bg-red-50 px-1 py-0.5 rounded transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onExternalLinkClick) {
                onExternalLinkClick(fullUrl);
              } else {
                window.open(fullUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            title="เปิดลิงก์ภายนอก"
          >
            <span>{part}</span>
            <ExternalLink className="w-3.5 h-3.5 ml-0.5 inline opacity-75 flex-shrink-0" />
          </a>
        );
      }
      if (part.startsWith('#')) {
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              onSelectTag?.(part);
            }}
            className="text-red-600 font-medium hover:underline inline-block"
          >
            {part}
          </button>
        );
      }
      if (part.startsWith('@')) {
        return (
          <span key={i} className="text-red-700 font-semibold bg-red-50 px-1 py-0.5 rounded text-xs">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <article className="hover:bg-gray-50 transition-colors border-b border-gray-100">
      {isReposted && (
        <div className="flex items-center px-4 pt-3 pb-1 text-xs text-gray-500 font-medium">
          <Repeat2 className="w-3.5 h-3.5 mr-2" />
          คุณได้รีโพสต์โพสต์นี้
        </div>
      )}
      <div className={`px-4 pb-5 sm:px-6 ${isReposted ? 'pt-1' : 'pt-5'}`}>
        <div className="flex space-x-3">
          <div className="flex-shrink-0">
            <img
              onClick={() => onProfileClick?.(post.author || { username: authorUsername, name: authorName, avatar: authorAvatar })}
              className="h-10 w-10 rounded-full bg-gray-100 border border-gray-200 object-cover cursor-pointer hover:opacity-85 hover:ring-2 hover:ring-red-400 transition-all"
              src={authorAvatar}
              alt={authorName}
              title={`ดูโปรไฟล์ของ ${authorName}`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                {(() => {
                  const isAdminPost = post.author?.isAdmin || post.author?.badge === '👑 Admin';
                  if (isAdminPost) {
                    const style = getBadgeStyle('👑 Admin');
                    return (
                      <button
                        onClick={() => onProfileClick?.(post.author)}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border} cursor-pointer hover:opacity-90 transition-opacity`}
                        title="ดูโปรไฟล์ 👑 Admin"
                      >
                        👑 Admin
                      </button>
                    );
                  }
                  return (
                    <>
                      <button
                        onClick={() => onProfileClick?.(post.author)}
                        className="text-sm font-bold text-gray-900 truncate hover:underline hover:text-red-600 transition-colors cursor-pointer text-left"
                        title={`ดูโปรไฟล์ของ ${authorName}`}
                      >
                        {authorName}
                      </button>
                      {post.author?.badge && (
                        (() => {
                          const style = getBadgeStyle(post.author.badge);
                          return (
                            <button
                              onClick={() => onProfileClick?.(post.author)}
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border} cursor-pointer hover:opacity-90 transition-opacity`}
                              title={post.author.badge}
                            >
                              {post.author.badge}
                            </button>
                          );
                        })()
                      )}
                      {!post.isAnonymous && authorUsername && (
                        <button
                          onClick={() => onProfileClick?.(post.author)}
                          className="text-xs text-gray-400 truncate hover:text-gray-600 hover:underline cursor-pointer"
                        >
                          @{authorUsername}
                        </button>
                      )}
                    </>
                  );
                })()}
              <span className="text-xs text-gray-400">·</span>
              <span className="text-xs text-gray-500" title={formatFullDateTime(post?.createdAtMs)}>
                {formatRelativeOrRealTime(post?.createdAtMs, post?.createdAt)}
              </span>
            </div>
            {(canDelete || canReport) && (
              <div className="relative" ref={menuRef}>
                <button 
                  onClick={() => setShowMenu(!showMenu)} 
                  className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-lg shadow-lg z-50 overflow-hidden py-1">
                    {canDelete && (
                      <button 
                        onClick={() => { onDelete?.(post.id); setShowMenu(false); }} 
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> ลบโพสต์
                      </button>
                    )}
                    {canReport && (
                      <button 
                        onClick={() => { onReport?.(post.id); setShowMenu(false); }} 
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center transition-colors"
                      >
                        <Flag className="w-4 h-4 mr-2" /> รายงานโพสต์
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">
            {renderContentWithLinks(post?.content || '')}
          </div>

          {post.image && (
            <div className="mt-3">
              <img
                src={post.image}
                alt="Post content"
                className="rounded-xl max-h-96 w-full object-cover border border-gray-200"
              />
            </div>
          )}

          {post.poll && Array.isArray(post.poll.options) && (
            <div className="mt-4 border border-gray-200 rounded-xl p-4">
              <div className="space-y-3">
                {post.poll.options.map((option) => {
                  const percentage = (post.poll?.totalVotes || 0) > 0 ? Math.round((option.votes / post.poll!.totalVotes) * 100) : 0;
                  const isVoted = votedOptionId === option.id;
                  
                  return (
                    <div 
                      key={option.id} 
                      className="relative"
                      onClick={() => !votedOptionId && onVote(post.id, option.id)}
                    >
                      <div className={`overflow-hidden h-8 text-xs flex rounded-md bg-gray-100 relative ${!votedOptionId ? 'cursor-pointer hover:bg-gray-200' : ''} transition-colors`}>
                        <div
                          style={{ width: `${percentage}%` }}
                          className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center absolute inset-0 h-full rounded-md z-0 ${isVoted ? 'bg-red-200' : 'bg-gray-200'}`}
                        ></div>
                        <div className="relative z-10 flex items-center justify-between w-full px-3 text-sm font-medium text-gray-900">
                          <span className={isVoted ? 'font-bold' : ''}>{option.text}</span>
                          {votedOptionId && <span>{percentage}%</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-gray-500 flex items-center">
                <span>{post.poll.totalVotes || 0} โหวต</span>
                <span className="mx-1">·</span>
                <span>{post.poll.expiresAt || ''}</span>
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button 
                  key={tag} 
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTag?.(tag);
                  }}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-gray-500 w-full max-w-md">
            <button 
              onClick={handleReplyClick}
              className={`flex items-center space-x-2 group ${showComments ? 'text-gray-900' : ''}`}
            >
              <div className={`p-2 rounded-full transition-colors ${showComments ? 'bg-gray-100' : 'group-hover:bg-gray-100 group-hover:text-gray-900'}`}>
                <MessageCircle className="w-5 h-5" fill={showComments ? "currentColor" : "none"} />
              </div>
              <span className={`text-xs transition-colors ${showComments ? '' : 'group-hover:text-gray-900'}`}>{stats.replies}</span>
            </button>
            <button 
              onClick={() => onInteraction(post.id, 'repost')}
              className={`flex items-center space-x-2 group ${isReposted ? 'text-green-600' : ''}`}
            >
              <div className={`p-2 rounded-full transition-colors ${isReposted ? 'bg-green-50' : 'group-hover:bg-green-50 group-hover:text-green-600'}`}>
                <Repeat2 className="w-5 h-5" />
              </div>
              <span className={`text-xs transition-colors ${isReposted ? '' : 'group-hover:text-green-600'}`}>{stats.reposts}</span>
            </button>
            <button 
              onClick={() => onInteraction(post.id, 'like')}
              className={`flex items-center space-x-2 group ${isLiked ? 'text-red-600' : ''}`}
            >
              <div className={`p-2 rounded-full transition-colors ${isLiked ? 'bg-red-50' : 'group-hover:bg-red-50 group-hover:text-red-600'}`}>
                <Heart className="w-5 h-5" fill={isLiked ? "currentColor" : "none"} />
              </div>
              <span className={`text-xs transition-colors ${isLiked ? '' : 'group-hover:text-red-600'}`}>{stats.likes}</span>
            </button>
            <button 
              onClick={() => onInteraction(post.id, 'bookmark')}
              className={`flex items-center space-x-2 group ${isBookmarked ? 'text-gray-900' : ''}`}
            >
              <div className={`p-2 rounded-full transition-colors ${isBookmarked ? 'bg-gray-100' : 'group-hover:bg-gray-100 group-hover:text-gray-900'}`}>
                <Bookmark className="w-5 h-5" fill={isBookmarked ? "currentColor" : "none"} />
              </div>
              <span className={`text-xs transition-colors ${isBookmarked ? '' : 'group-hover:text-gray-900'}`}>{stats.bookmarks}</span>
            </button>
            <button 
              onClick={handleShare}
              className="flex items-center space-x-2 group"
            >
              <div className="p-2 rounded-full group-hover:bg-gray-100 group-hover:text-gray-900 transition-colors">
                <Share className="w-5 h-5" />
              </div>
            </button>
          </div>

          {showComments && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {Array.isArray(post.comments) && post.comments.length > 0 && (
                <div className="space-y-4 mb-4">
                  {post.comments.map((comment) => {
                    const cAuthorName = comment?.author?.name || comment?.author?.username || 'ผู้ใช้งาน';
                    const cAuthorUsername = comment?.author?.username || '';
                    const cAuthorAvatar = comment?.author?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cAuthorUsername || 'user')}&backgroundColor=cccccc`;

                    return (
                      <div key={comment.id} className="flex space-x-3">
                        <div className="flex-shrink-0">
                          <img 
                            onClick={() => onProfileClick?.(comment.author)}
                            className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200 object-cover cursor-pointer hover:opacity-85 hover:ring-1 hover:ring-red-400 transition-all" 
                            src={cAuthorAvatar} 
                            alt={cAuthorName} 
                            title={`ดูโปรไฟล์ของ ${cAuthorName}`}
                          />
                        </div>
                        <div className="min-w-0 flex-1 bg-gray-50 rounded-2xl px-4 py-2">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            {(() => {
                              const isAdminComment = comment.author?.isAdmin || comment.author?.badge === '👑 Admin';
                              if (isAdminComment) {
                                const style = getBadgeStyle('👑 Admin');
                                return (
                                  <button 
                                    onClick={() => onProfileClick?.(comment.author)}
                                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${style.bg} ${style.text} ${style.border} cursor-pointer hover:opacity-90`}
                                  >
                                    👑 Admin
                                  </button>
                                );
                              }
                              return (
                                <>
                                  <button 
                                    onClick={() => onProfileClick?.(comment.author)}
                                    className="text-sm font-bold text-gray-900 hover:underline hover:text-red-600 cursor-pointer text-left"
                                  >
                                    {cAuthorName}
                                  </button>
                                  {comment.author?.badge && (
                                    (() => {
                                      const style = getBadgeStyle(comment.author.badge);
                                      return (
                                        <button 
                                          onClick={() => onProfileClick?.(comment.author)}
                                          className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-bold border ${style.bg} ${style.text} ${style.border} cursor-pointer hover:opacity-90`}
                                        >
                                          {comment.author.badge}
                                        </button>
                                      );
                                    })()
                                  )}
                                </>
                              );
                            })()}
                            <span className="text-xs text-gray-400" title={formatFullDateTime(comment?.createdAtMs)}>
                              {formatRelativeOrRealTime(comment?.createdAtMs, comment?.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">{renderContentWithLinks(comment?.content || '')}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {user ? (
                <form onSubmit={submitComment} className="flex items-start space-x-3 mt-4">
                  <div className="flex-shrink-0">
                    <img className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200" src={user.avatar || (user.isAdmin ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username || 'user')}&backgroundColor=cccccc`)} alt={user.username || 'user'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="relative">
                      <textarea
                        rows={1}
                        className="block w-full rounded-2xl border-gray-300 py-2.5 px-4 bg-gray-50 focus:bg-white text-sm focus:border-red-500 focus:ring-red-500 resize-none overflow-hidden"
                        placeholder="แสดงความคิดเห็น..."
                        value={commentText}
                        onChange={(e) => {
                          setCommentText(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = (e.target.scrollHeight) + 'px';
                        }}
                      />
                      <button
                        type="submit"
                        disabled={!commentText.trim()}
                        className="absolute right-2 bottom-1.5 p-1.5 rounded-full text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="text-center py-3 bg-gray-50 rounded-xl">
                  <p className="text-sm text-gray-500">
                    กรุณาเข้าสู่ระบบผ่าน<a href="https://mtexam-passalldiwa.ai.studio/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mx-1">เว็บไซต์หลัก</a>เพื่อแสดงความคิดเห็น
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
    </article>
  );
}
