import React from 'react';
import { PostComposer } from './PostComposer';
import { PostItem } from './PostItem';
import { MOCK_USERS } from '../data';
import { Post, Comment, SessionUser } from '../types';
import { deletePostFromFirestore, savePostToFirestore } from '../utils/firestoreService';

export function Feed({ 
  posts = [],
  setPosts,
  activeCategory, 
  user,
  onLoginClick,
  externalSharedText,
  onClearExternalSharedText,
  selectedTag,
  onSelectTag,
  searchQuery,
  onClearSearch,
  registeredUsers = [],
  onMention,
  onExternalLinkClick,
  onReportPost
}: { 
  posts?: Post[];
  setPosts?: React.Dispatch<React.SetStateAction<Post[]>>;
  activeCategory: string;
  user: SessionUser | null;
  onLoginClick: () => void;
  isAdminBoardOpen?: boolean;
  onCloseAdminBoard?: () => void;
  externalSharedText?: string | null;
  onClearExternalSharedText?: () => void;
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  registeredUsers?: SessionUser[];
  onMention?: (data: {
    recipientUsername: string;
    authorName: string;
    authorAvatar?: string;
    contentPreview: string;
    targetPostId?: string;
  }) => void;
  onExternalLinkClick?: (url: string) => void;
  onReportPost?: (postId: string) => void;
}) {

  const handlePost = (content: string, isAnonymous: boolean, image?: string, poll?: { options: { id: string, text: string, votes: number }[], expiresAt: string, totalVotes: number }) => {
    const author = (isAnonymous || !user) 
      ? MOCK_USERS.anon 
      : { 
          id: user.uid || user.id || user.username, 
          name: user.name || (user.isAdmin ? 'Admin' : user.username), 
          username: user.username, 
          avatar: user.avatar || (user.isAdmin ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=cccccc`),
          badge: user.badge || (user.isAdmin ? '👑 Admin' : '🔬🎓 นศ.เทคนิคการแพทย์'),
          userGroup: user.userGroup,
          academicYear: user.academicYear,
          faculty: user.faculty,
          university: user.university
        };

    // Automatically extract hashtags from content if any
    const tagsFromContent = content.match(/#[\w\u0E00-\u0E7F]+/g) || [];

    const newPostId = `new_${Date.now()}`;
    const newPost: Post = {
      id: newPostId,
      author,
      content,
      image,
      poll,
      tags: tagsFromContent,
      createdAt: 'เมื่อสักครู่',
      isAnonymous,
      stats: { replies: 0, reposts: 0, likes: 0, bookmarks: 0 },
      comments: []
    };

    if (setPosts) {
      setPosts(prev => [newPost, ...prev]);
    }
    savePostToFirestore(newPost);

    // Extract @mentions and notify recipient
    const matches = content.match(/@([\w\u0E00-\u0E7F]+)/g);
    const mentions: string[] = matches ? Array.from(matches) : [];
    if (mentions.length > 0 && onMention) {
      mentions.forEach((m: string) => {
        const cleanRecipient = m.replace(/^@/, '');
        onMention({
          recipientUsername: cleanRecipient,
          authorName: author.name,
          authorAvatar: author.avatar,
          contentPreview: content,
          targetPostId: newPostId
        });
      });
    }
  };

  const handleDeletePost = (postId: string) => {
    if (setPosts) {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }
    deletePostFromFirestore(postId);
  };

  const handleReportPost = (postId: string) => {
    if (setPosts) {
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const updated = { ...p, isReported: true };
          savePostToFirestore(updated);
          return updated;
        }
        return p;
      }));
    }
    onReportPost?.(postId);
    alert('ขอบคุณที่รายงาน โพสต์นี้ถูกส่งให้ผู้ดูแลระบบตรวจสอบแล้ว');
  };

  const handleComment = (postId: string, content: string) => {
    if (!user) {
      onLoginClick();
      return;
    }

    const author = { 
      id: user.uid || user.id || user.username, 
      name: user.name || (user.isAdmin ? 'Admin' : user.username), 
      username: user.username, 
      avatar: user.avatar || (user.isAdmin ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' : `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}&backgroundColor=cccccc`),
      badge: user.badge || (user.isAdmin ? '👑 Admin' : '🔬🎓 นศ.เทคนิคการแพทย์'),
      userGroup: user.userGroup,
      academicYear: user.academicYear,
      faculty: user.faculty,
      university: user.university
    };

    const newComment: Comment = {
      id: `comment_${Date.now()}`,
      author,
      content,
      createdAt: 'เมื่อสักครู่'
    };

    const targetPost = posts.find(p => p.id === postId);
    if (targetPost) {
      const newComments = [...(targetPost.comments || []), newComment];
      const updatedPost: Post = {
        ...targetPost,
        comments: newComments,
        stats: {
          ...targetPost.stats,
          replies: newComments.length
        }
      };
      savePostToFirestore(updatedPost);
    }

    if (setPosts) {
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        
        const newComments = [...(post.comments || []), newComment];
        return {
          ...post,
          comments: newComments,
          stats: {
            ...post.stats,
            replies: newComments.length
          }
        };
      }));
    }

    // Extract @mentions from comment
    const commentMatches = content.match(/@([\w\u0E00-\u0E7F]+)/g);
    const mentions: string[] = commentMatches ? Array.from(commentMatches) : [];
    if (mentions.length > 0 && onMention) {
      mentions.forEach((m: string) => {
        const cleanRecipient = m.replace(/^@/, '');
        onMention({
          recipientUsername: cleanRecipient,
          authorName: author.name,
          authorAvatar: author.avatar,
          contentPreview: `ในความคิดเห็น: ${content}`,
          targetPostId: postId
        });
      });
    }
  };

  const handleInteraction = (postId: string, type: 'reply' | 'repost' | 'like' | 'bookmark') => {
    if (!user && type !== 'reply') {
      onLoginClick();
      return;
    }

    const targetPost = posts.find(p => p.id === postId);
    if (targetPost) {
      const newStats = { ...targetPost.stats };
      const newInteractions = { ...(targetPost.userInteractions || {}) };

      if (type === 'like') {
        const currentlyLiked = newInteractions.liked;
        newInteractions.liked = !currentlyLiked;
        newStats.likes += currentlyLiked ? -1 : 1;
      } else if (type === 'repost') {
        const currentlyReposted = newInteractions.reposted;
        newInteractions.reposted = !currentlyReposted;
        newStats.reposts += currentlyReposted ? -1 : 1;
      } else if (type === 'bookmark') {
        const currentlyBookmarked = newInteractions.bookmarked;
        newInteractions.bookmarked = !currentlyBookmarked;
        newStats.bookmarks += currentlyBookmarked ? -1 : 1;
      }

      const updatedPost: Post = {
        ...targetPost,
        stats: newStats,
        userInteractions: newInteractions
      };
      savePostToFirestore(updatedPost);
    }

    if (setPosts) {
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        
        const newStats = { ...post.stats };
        const newInteractions = { ...(post.userInteractions || {}) };

        if (type === 'like') {
          const currentlyLiked = newInteractions.liked;
          newInteractions.liked = !currentlyLiked;
          newStats.likes += currentlyLiked ? -1 : 1;
        } else if (type === 'repost') {
          const currentlyReposted = newInteractions.reposted;
          newInteractions.reposted = !currentlyReposted;
          newStats.reposts += currentlyReposted ? -1 : 1;
        } else if (type === 'bookmark') {
          const currentlyBookmarked = newInteractions.bookmarked;
          newInteractions.bookmarked = !currentlyBookmarked;
          newStats.bookmarks += currentlyBookmarked ? -1 : 1;
        }

        return {
          ...post,
          stats: newStats,
          userInteractions: newInteractions
        };
      }));
    }
  };

  const handleVote = (postId: string, optionId: string) => {
    if (!user) {
      onLoginClick();
      return;
    }

    const targetPost = posts.find(p => p.id === postId);
    if (targetPost && targetPost.poll && !targetPost.userInteractions?.votedOptionId) {
      const newPoll = { ...targetPost.poll };
      newPoll.options = newPoll.options.map(opt => 
        opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
      );
      newPoll.totalVotes += 1;

      const updatedPost: Post = {
        ...targetPost,
        poll: newPoll,
        userInteractions: {
          ...(targetPost.userInteractions || {}),
          votedOptionId: optionId
        }
      };
      savePostToFirestore(updatedPost);
    }

    if (setPosts) {
      setPosts(prev => prev.map(post => {
        if (post.id !== postId || !post.poll || post.userInteractions?.votedOptionId) return post;

        const newPoll = { ...post.poll };
        newPoll.options = newPoll.options.map(opt => 
          opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
        );
        newPoll.totalVotes += 1;

        return {
          ...post,
          poll: newPoll,
          userInteractions: {
            ...(post.userInteractions || {}),
            votedOptionId: optionId
          }
        };
      }));
    }
  };

  const getFilteredPosts = () => {
    let result = posts;

    // Filter by selected tag/trend
    if (selectedTag) {
      const cleanTag = selectedTag.trim().toLowerCase();
      result = result.filter(post => {
        const inTags = post.tags && post.tags.some(t => t.toLowerCase() === cleanTag || t.toLowerCase().includes(cleanTag.replace('#', '')));
        const inContent = post.content && (post.content.toLowerCase().includes(cleanTag) || post.content.toLowerCase().includes(cleanTag.replace('#', '')));
        return inTags || inContent;
      });
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(post => 
        post.content?.toLowerCase().includes(q) ||
        post.author?.name?.toLowerCase().includes(q) ||
        post.author?.username?.toLowerCase().includes(q) ||
        (post.tags && post.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Filter by category
    switch (activeCategory) {
      case 'mine':
        return result.filter(post => 
          (user && post.author.username === user.username) || post.userInteractions?.reposted
        );
      case 'bookmarks':
        return result.filter(post => post.userInteractions?.bookmarked);
      case 'all':
      default:
        return result;
    }
  };

  const displayedPosts = getFilteredPosts();

  return (
    <div className="flex-1 max-w-2xl w-full mx-auto md:mx-0 border-x border-gray-200 min-h-screen bg-white">
      <div className="sticky top-16 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 sm:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 cursor-pointer">
            {selectedTag ? `แท็ก: ${selectedTag}` : searchQuery ? `ค้นหา: "${searchQuery}"` : 'ฟีดหลัก (Timeline)'}
          </h1>
          {(selectedTag || searchQuery) && (
            <p className="text-xs text-gray-500 mt-0.5">
              พบ {displayedPosts.length} โพสต์ที่ตรงกัน
            </p>
          )}
        </div>

        {(selectedTag || searchQuery) && (
          <button
            onClick={() => {
              onSelectTag?.(null);
              onClearSearch?.();
            }}
            className="text-xs font-semibold px-3 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded-full transition-colors"
          >
            ล้างตัวกรอง ✕
          </button>
        )}
      </div>

      <PostComposer 
        onPost={handlePost} 
        user={user} 
        externalSharedText={externalSharedText}
        onClearExternalSharedText={onClearExternalSharedText}
        registeredUsers={registeredUsers}
      />

      <div className="divide-y divide-gray-100">
        {displayedPosts.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {selectedTag ? (
              <>
                <p>ไม่พบโพสต์ที่ติดแท็ก <span className="font-semibold text-red-600">{selectedTag}</span></p>
                <button 
                  onClick={() => onSelectTag?.(null)}
                  className="mt-2 text-sm text-red-600 font-medium hover:underline block mx-auto"
                >
                  กลับไปดูโพสต์ทั้งหมด
                </button>
              </>
            ) : searchQuery ? (
              <>
                <p>ไม่พบโพสต์ที่ตรงกับคำค้นหา "{searchQuery}"</p>
                <button 
                  onClick={() => onClearSearch?.()}
                  className="mt-2 text-sm text-red-600 font-medium hover:underline block mx-auto"
                >
                  ล้างคำค้นหา
                </button>
              </>
            ) : (
              "ยังไม่มีโพสต์ในหมวดหมู่นี้"
            )}
          </div>
        ) : (
          displayedPosts.map((post) => (
            <PostItem 
              key={post.id} 
              post={post} 
              onInteraction={handleInteraction}
              onVote={handleVote}
              onComment={handleComment}
              onDelete={handleDeletePost}
              onReport={handleReportPost}
              user={user}
              onSelectTag={onSelectTag}
              onExternalLinkClick={onExternalLinkClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
