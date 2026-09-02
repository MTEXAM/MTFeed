export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  badge?: string;
  userGroup?: string;
  academicYear?: string;
  faculty?: string;
  university?: string;
  isAdmin?: boolean;
}

export interface SessionUser {
  id?: string;
  uid: string; // 8-character permanent unique identifier (e.g. "8A9K2L1P")
  username: string;
  name?: string;
  avatar?: string;
  email?: string;
  isAdmin: boolean;
  isEmergencyAdmin?: boolean;
  needsAdminVerification?: boolean;
  userGroup?: string;
  academicYear?: string;
  faculty?: string;
  university?: string;
  badge?: string;
  joinedAt?: string;
  updatedAt?: number;
}

export interface AppNotification {
  id: string;
  type: 'like' | 'comment' | 'mention' | 'system' | 'badge';
  title: string;
  description: string;
  authorName?: string;
  authorAvatar?: string;
  targetPostId?: string;
  targetTag?: string;
  recipientUsername?: string; // target recipient username or empty for global broadcast
  createdAt: string;
  createdAtMs?: number;
  read: boolean;
  senderType?: 'admin' | 'system' | 'user';
  severity?: 'info' | 'warning' | 'alert' | 'success';
  isBroadcast?: boolean;
}

export interface Comment {
  id: string;
  author: User;
  content: string;
  createdAt: string;
  createdAtMs?: number;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface Post {
  id: string;
  author: User;
  content: string;
  image?: string;
  poll?: {
    options: PollOption[];
    expiresAt: string;
    totalVotes: number;
  };
  tags: string[];
  createdAt: string;
  createdAtMs?: number;
  stats: {
    replies: number;
    reposts: number;
    likes: number;
    bookmarks: number;
  };
  isAnonymous?: boolean;
  userInteractions?: {
    liked?: boolean;
    reposted?: boolean;
    bookmarked?: boolean;
    votedOptionId?: string;
  };
  repostedBy?: string[];
  likedBy?: string[];
  bookmarkedBy?: string[];
  votedBy?: { uid: string; optionId: string }[];
  repostedUsers?: {
    username: string;
    name?: string;
    avatar?: string;
    uid?: string;
  }[];
  comments?: Comment[];
  isReported?: boolean;
}

export interface Trend {
  id: string;
  tag: string;
  postCount: number;
}

export interface ExamCountdownConfig {
  title: string;
  organizer: string;
  targetDateTime: string | null; // ISO string e.g. "2026-09-11T12:32:00" or null
  note?: string;
  updatedBy?: string;
  updatedAt?: number;
}
