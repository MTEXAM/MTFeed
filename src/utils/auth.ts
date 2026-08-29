import { SessionUser, AppNotification } from '../types';
import { saveUserToFirestore, deleteUserFromFirestore, clearAllUsersFromFirestore } from './firestoreService';

// Deterministic 8-char hash generator from string
export function generateHash8(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const positiveHash = Math.abs(hash);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  let temp = positiveHash;
  for (let i = 0; i < 8; i++) {
    result += chars[temp % chars.length];
    temp = Math.floor(temp / chars.length) + (i * 7) + 13;
  }
  return result.slice(0, 8);
}

// Generate random 8-character alphanumeric code
export function generateRandomUid8(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Accounts registry key in localStorage
const REGISTRY_KEY = 'mtfeed_accounts_registry';

const DEFAULT_ACTIVE_USERS: Record<string, SessionUser> = {
  'BANK2026': {
    uid: 'BANK2026',
    username: 'admin_master',
    name: 'Admin Bank',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin_master',
    isAdmin: true,
    userGroup: '👑 Admin',
    academicYear: 'ปี 5+',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: '👑 Admin'
  },
  'MED68001': {
    uid: 'MED68001',
    username: 'somchai_mt',
    name: 'สมชาย เทค',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=somchai_mt',
    isAdmin: false,
    userGroup: '🔬🎓 นศ.เทคนิคการแพทย์',
    academicYear: 'ปี 3',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: '🔬🎓 นศ.เทคนิคการแพทย์ • ปี 3'
  },
  'MED67012': {
    uid: 'MED67012',
    username: 'jiraporn_med',
    name: 'จิรภรณ์ ตรวจเลือด',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jiraporn_med',
    isAdmin: false,
    userGroup: '🔬 นักเทคนิคการแพทย์',
    academicYear: 'ปี 4',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: '🔬 นักเทคนิคการแพทย์'
  },
  'MED67890': {
    uid: 'MED67890',
    username: 'kanokwan_exam',
    name: 'กนกวรรณ เตรียมสอบ',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kanokwan_exam',
    isAdmin: false,
    userGroup: '📝 เตรียมสอบสภาฯ',
    academicYear: 'ปี 4',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: '📝 เตรียมสอบสภาฯ'
  }
};

// Broadcast channel for real-time multi-tab sync
export const mtFeedChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mtfeed_realtime_sync') : null;

export function getRegisteredUsers(): Record<string, SessionUser> {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    if (!raw) {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(DEFAULT_ACTIVE_USERS));
      return { ...DEFAULT_ACTIVE_USERS };
    }
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (e) {
    console.error('Failed to load accounts registry', e);
    return { ...DEFAULT_ACTIVE_USERS };
  }
}

export function saveRegisteredUser(user: SessionUser): void {
  try {
    const registry = getRegisteredUsers();
    registry[user.uid] = user;
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    if (mtFeedChannel) {
      mtFeedChannel.postMessage({ type: 'USER_REGISTERED', user });
    }
    // Async save to Cloud Firestore
    saveUserToFirestore(user);
  } catch (e) {
    console.error('Failed to save account to registry', e);
  }
}

export function findUserByUsername(username: string): SessionUser | null {
  const registry = getRegisteredUsers();
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  for (const uid in registry) {
    if (registry[uid].username && registry[uid].username.toLowerCase() === clean) {
      return registry[uid];
    }
  }
  return null;
}

export function deleteRegisteredUser(uidOrUsername: string): boolean {
  try {
    const registry = getRegisteredUsers();
    const clean = uidOrUsername.trim().toLowerCase().replace(/^@/, '').replace(/^#/, '');
    let deletedKey: string | null = null;
    
    for (const key in registry) {
      const u = registry[key];
      if (
        key.toLowerCase() === clean ||
        (u.uid && u.uid.toLowerCase().replace(/^#/, '') === clean) ||
        (u.username && u.username.toLowerCase().replace(/^@/, '') === clean) ||
        (u.id && u.id.toLowerCase() === clean)
      ) {
        deletedKey = key;
        delete registry[key];
        break;
      }
    }

    // Also delete from Firestore
    deleteUserFromFirestore(uidOrUsername);

    if (deletedKey) {
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      if (mtFeedChannel) {
        mtFeedChannel.postMessage({ type: 'USER_REGISTERED' });
      }
      return true;
    }
    return false;
  } catch (e) {
    console.error('Failed to delete user', e);
    return false;
  }
}

export function clearAllRegisteredUsers(keepUser?: SessionUser): void {
  try {
    const newRegistry: Record<string, SessionUser> = {};
    if (keepUser) {
      newRegistry[keepUser.uid] = keepUser;
    } else {
      const defaultAdmin: SessionUser = {
        id: 'BANK2026',
        uid: 'BANK2026',
        username: 'admin_bank',
        name: 'Admin Bank',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5',
        isAdmin: true,
        userGroup: '👑 Admin',
        academicYear: 'ปี 5+',
        faculty: 'คณะเทคนิคการแพทย์',
        badge: '👑 Admin'
      };
      newRegistry['BANK2026'] = defaultAdmin;
    }
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(newRegistry));
    if (mtFeedChannel) {
      mtFeedChannel.postMessage({ type: 'USER_REGISTERED' });
    }
    // Also clear from Firestore
    clearAllUsersFromFirestore(keepUser);
  } catch (e) {
    console.error('Failed to clear users registry', e);
  }
}

export const USER_GROUPS = [
  '🔬🎓 นศ.เทคนิคการแพทย์',
  '📝 เตรียมสอบสภาฯ',
  '🔬 นักเทคนิคการแพทย์',
  '🎓 นักศึกษา',
  '🏫 นักเรียน',
  '👤 ผู้ใช้งานทั่วไป'
] as const;

export const ACADEMIC_YEARS = [
  'ปี 1',
  'ปี 2',
  'ปี 3',
  'ปี 4',
  'ปี 5+ / จบแล้ว'
] as const;

export function formatUserBadge(user: {
  isAdmin?: boolean;
  userGroup?: string;
  academicYear?: string;
  badge?: string;
  username?: string;
}): string {
  if (user.isAdmin || user.badge === '👑 Admin' || user.userGroup?.includes('Admin') || user.userGroup?.includes('ผู้ดูแลระบบ') || user.username?.toLowerCase() === 'bank') return '👑 Admin';
  if (user.badge) return user.badge;
  
  if (user.userGroup) {
    const group = user.userGroup.trim();
    // If student group with year
    if (user.academicYear && (group.includes('นศ.') || group.includes('นักศึกษา') || group.includes('นักเรียน'))) {
      const cleanYear = user.academicYear.replace(/\(.*?\)/g, '').trim();
      return `${group} • ${cleanYear}`;
    }
    return group;
  }
  
  return '🔬🎓 นศ.เทคนิคการแพทย์';
}

export function getBadgeStyle(badge?: string): { bg: string; text: string; border: string } {
  if (!badge) {
    return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
  }
  if (badge.includes('Admin')) {
    return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
  }
  if (badge.includes('เตรียมสอบสภา')) {
    return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
  }
  if (badge.includes('นักเทคนิคการแพทย์') && !badge.includes('นศ.')) {
    return { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' };
  }
  if (badge.includes('นักศึกษา')) {
    return { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' };
  }
  if (badge.includes('นักเรียน')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
  }
  if (badge.includes('ผู้ใช้งานทั่วไป')) {
    return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' };
  }
  // Default MedTech student
  return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
}

export function getAllRegisteredUsersList(): SessionUser[] {
  const registry = getRegisteredUsers();
  return Object.values(registry);
}

export function resolveUserAccount(params: {
  username: string;
  uidParam?: string | null;
  displayName?: string | null;
  avatar?: string | null;
  role?: string | null;
  userGroupParam?: string | null;
  academicYearParam?: string | null;
  facultyParam?: string | null;
  universityParam?: string | null;
  verifiedAdmin?: boolean;
}): SessionUser {
  const cleanUsername = params.username.trim().replace(/^@/, '');
  
  // 1. If explicit 8-char UID passed from exam web
  let uid = '';
  if (params.uidParam && params.uidParam.trim().length >= 4) {
    uid = params.uidParam.trim().toUpperCase().slice(0, 8);
  }

  const registry = getRegisteredUsers();

  // --- Strict Duplicate Username Check ---
  // Check if username is already registered under a DIFFERENT UID
  const existingByUsername = findUserByUsername(cleanUsername);
  if (existingByUsername && (!uid || existingByUsername.uid !== uid)) {
    alert(`❌ ปฏิเสธการเข้าสู่ระบบ! ชื่อผู้ใช้ "@${cleanUsername}" มีผู้ใช้งานอื่นครอบครองอยู่แล้วในระบบ MTFeed`);
    throw new Error(`Duplicate username: @${cleanUsername}`);
  }

  // --- Admin Password Verification (Bank2546) ---
  const isRequestedAdmin = params.role === 'admin' || params.role === 'true' || params.role === '1' || cleanUsername.toLowerCase() === 'bank' || cleanUsername.toLowerCase() === 'admin_bank';
  
  // If verifiedAdmin is passed explicitly or saved in sessionStorage
  const isAlreadyVerified = params.verifiedAdmin || sessionStorage.getItem(`mt_admin_verified_${cleanUsername}`) === 'true';
  const isAdmin = isRequestedAdmin && isAlreadyVerified;
  const needsAdminVerification = isRequestedAdmin && !isAlreadyVerified;

  const userGroup = params.userGroupParam ? decodeURIComponent(params.userGroupParam).trim() : undefined;
  const academicYear = params.academicYearParam ? decodeURIComponent(params.academicYearParam).trim() : undefined;
  const faculty = params.facultyParam ? decodeURIComponent(params.facultyParam).trim() : undefined;
  const university = params.universityParam ? decodeURIComponent(params.universityParam).trim() : undefined;

  const computedBadge = formatUserBadge({
    isAdmin: isAdmin || isRequestedAdmin,
    userGroup: userGroup || (isRequestedAdmin ? '👑 Admin' : '🔬🎓 นศ.เทคนิคการแพทย์'),
    academicYear: academicYear || (isRequestedAdmin ? undefined : 'ปี 3'),
    username: cleanUsername
  });

  // If UID provided and exists in registry, load and merge
  if (uid && registry[uid]) {
    const existing = registry[uid];
    const updatedUser: SessionUser = {
      ...existing,
      username: cleanUsername || existing.username,
      name: params.displayName ? decodeURIComponent(params.displayName).trim() : existing.name,
      avatar: params.avatar ? decodeURIComponent(params.avatar).trim() : existing.avatar,
      userGroup: userGroup || existing.userGroup || '🔬🎓 นศ.เทคนิคการแพทย์',
      academicYear: academicYear || existing.academicYear || 'ปี 3',
      faculty: faculty || existing.faculty,
      university: university || existing.university,
      badge: computedBadge,
      isAdmin: isAdmin ? true : (isRequestedAdmin ? false : existing.isAdmin),
      needsAdminVerification
    };
    saveRegisteredUser(updatedUser);
    return updatedUser;
  }

  // If existing by username and matches UID
  if (existingByUsername) {
    const updatedUser: SessionUser = {
      ...existingByUsername,
      uid: uid || existingByUsername.uid,
      name: params.displayName ? decodeURIComponent(params.displayName).trim() : existingByUsername.name,
      avatar: params.avatar ? decodeURIComponent(params.avatar).trim() : existingByUsername.avatar,
      userGroup: userGroup || existingByUsername.userGroup || '🔬🎓 นศ.เทคนิคการแพทย์',
      academicYear: academicYear || existingByUsername.academicYear || 'ปี 3',
      faculty: faculty || existingByUsername.faculty,
      university: university || existingByUsername.university,
      badge: computedBadge,
      isAdmin: isAdmin ? true : (isRequestedAdmin ? false : existingByUsername.isAdmin),
      needsAdminVerification
    };
    saveRegisteredUser(updatedUser);
    return updatedUser;
  }

  // Otherwise create new permanent user with 8-char UID
  const finalUid = uid || (isRequestedAdmin ? 'BANK2026' : generateHash8(cleanUsername + '_mt'));
  const cleanDisplayName = params.displayName 
    ? decodeURIComponent(params.displayName).trim() 
    : (isRequestedAdmin ? 'Admin Bank' : cleanUsername);
    
  const cleanAvatar = params.avatar 
    ? decodeURIComponent(params.avatar).trim() 
    : (isRequestedAdmin 
        ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' 
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=cccccc`);

  const newUser: SessionUser = {
    id: finalUid,
    uid: finalUid,
    username: cleanUsername,
    name: cleanDisplayName,
    avatar: cleanAvatar,
    userGroup: userGroup || (isRequestedAdmin ? '👑 Admin' : '🔬🎓 นศ.เทคนิคการแพทย์'),
    academicYear: academicYear || (isRequestedAdmin ? undefined : 'ปี 3'),
    faculty: faculty || 'คณะเทคนิคการแพทย์',
    university: university || '',
    badge: computedBadge,
    isAdmin: isAdmin,
    needsAdminVerification,
    joinedAt: new Date().toLocaleDateString('th-TH')
  };

  saveRegisteredUser(newUser);
  return newUser;
}

// Generate default notifications for user
export function getInitialNotifications(user: SessionUser | null): AppNotification[] {
  const uidStr = user ? user.uid : 'MT2026';
  const nameStr = user ? (user.name || user.username) : 'เพื่อนๆ สมาชิก';

  return [
    {
      id: 'notif_sys_1',
      type: 'system',
      title: `ความปลอดภัย: เชื่อมต่อบัญชีรหัส 8 หลัก (UID: #${uidStr})`,
      description: `ระบบล็อคบัญชีของคุณกับรหัสประจำตัว #${uidStr} ป้องกันชื่อซ้ำและเก็บข้อมูลโพสต์/บุ๊กมาร์กให้อัตโนมัติทุกครั้งที่เข้าใช้งาน`,
      createdAt: 'เมื่อสักครู่',
      read: false
    },
    {
      id: 'notif_admin_welcome',
      type: 'badge',
      title: 'ยินดีต้อนรับสู่ MTFeed ชุมชนนักเทคนิคการแพทย์',
      description: `สวัสดีคุณ ${nameStr}! มาร่วมพูดคุย ถาม-ตอบ แลกเปลี่ยนทริคจำและแนวข้อสอบสภาวิชาชีพได้ตลอด 24 ชม.`,
      authorName: 'Admin Bank',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5',
      createdAt: '10 นาทีที่แล้ว',
      read: false
    },
    {
      id: 'notif_like_1',
      type: 'like',
      title: 'พี่หมอแล็บใจดี และสมาชิกอีก 8 คน ถูกใจโพสต์',
      description: 'มีเพื่อนๆ ให้ความสนใจและกดถูกใจในประเด็นยอดนิยม "#สอบสภาครั้งที่1"',
      authorName: 'พี่หมอแล็บใจดี',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MorLab&backgroundColor=bbf7d0',
      targetTag: '#สอบสภาครั้งที่1',
      createdAt: '25 นาทีที่แล้ว',
      read: false
    },
    {
      id: 'notif_comment_1',
      type: 'comment',
      title: 'Chem Specialist แสดงความคิดเห็นใหม่',
      description: '"สรุปเคมีคลินิกชุดนี้มีประโยชน์มากเลยครับ ขอบคุณที่แชร์นะครับ!"',
      authorName: 'Chem Specialist',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ChemGuru&backgroundColor=fed7aa',
      targetTag: '#เคมีคลินิก',
      createdAt: '1 ชั่วโมงที่แล้ว',
      read: true
    }
  ];
}
