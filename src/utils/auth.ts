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

export const DEFAULT_ACTIVE_USERS: Record<string, SessionUser> = {
  'MED68001': {
    uid: 'MED68001',
    username: 'bank',
    name: 'bank',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5',
    isAdmin: true,
    userGroup: '👑 Admin',
    academicYear: 'ปี 5+',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: '👑 Admin'
  },
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
  'MED67012': {
    uid: 'MED67012',
    username: 'jiraporn_med',
    name: 'จิรภรณ์ ตรวจเลือด',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=jiraporn_med',
    isAdmin: false,
    userGroup: '',
    academicYear: 'ปี 4',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: ''
  },
  'MED67890': {
    uid: 'MED67890',
    username: 'kanokwan_exam',
    name: 'กนกวรรณ เตรียมสอบ',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=kanokwan_exam',
    isAdmin: false,
    userGroup: '',
    academicYear: 'ปี 4',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: ''
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
    const key = user.uid || user.username || user.id;
    if (key) {
      const existing = registry[key];
      registry[key] = {
        ...existing,
        ...user,
        name: user.name || existing?.name || user.username
      };
    }
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
    if (mtFeedChannel) {
      mtFeedChannel.postMessage({ type: 'USER_REGISTERED', user: registry[key] });
    }
    // Async save to Cloud Firestore
    saveUserToFirestore(registry[key]);
  } catch (e) {
    console.error('Failed to save account to registry', e);
  }
}

export function findUserByUsername(username: string): SessionUser | null {
  if (!username) return null;
  const registry = getRegisteredUsers();
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  for (const uid in registry) {
    const u = registry[uid];
    if (u && u.username && u.username.toLowerCase().replace(/^@/, '') === clean) {
      return u;
    }
  }
  return null;
}

export function deleteRegisteredUser(uidOrUsername: string): boolean {
  if (!uidOrUsername) return false;
  try {
    const registry = getRegisteredUsers();
    const clean = uidOrUsername.trim().toLowerCase().replace(/^@/, '').replace(/^#/, '');
    let deletedKey: string | null = null;
    
    for (const key in registry) {
      const u = registry[key];
      if (!u) continue;
      if (
        key.toLowerCase() === clean ||
        (u.uid && u.uid.toLowerCase().replace(/^#/, '') === clean) ||
        (u.username && u.username.toLowerCase().replace(/^@/, '') === clean) ||
        (u.id && String(u.id).toLowerCase() === clean)
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

export function maskUid(uid: string | undefined, currentUser?: { isAdmin?: boolean; uid?: string } | null): string {
  if (!uid) return '';
  // If the viewer is an Admin, they can see anyone's UID
  if (currentUser?.isAdmin) {
    return uid;
  }
  // If the viewer is the user themselves (matching UID), they can see their own UID
  if (currentUser && currentUser.uid === uid) {
    return uid;
  }
  // Otherwise, mask the UID: keep first character, mask the middle, keep last character
  if (uid.length >= 3) {
    return uid[0] + '*'.repeat(uid.length - 2) + uid[uid.length - 1];
  }
  return '********';
}

export function formatUserBadge(user?: { isAdmin?: boolean; userGroup?: string; academicYear?: string; badge?: string; username?: string; uid?: string; } | null): string {
  if (!user) return "";
  if (user.isAdmin) return "👑 Admin";
  return "";
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
  try {
    const registry = getRegisteredUsers();
    if (!registry || typeof registry !== 'object') return Object.values(DEFAULT_ACTIVE_USERS);
    return Object.values(registry).filter((u): u is SessionUser => Boolean(u && (u.uid || u.username || u.name)));
  } catch (e) {
    return Object.values(DEFAULT_ACTIVE_USERS);
  }
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
  const rawUsername = params.username.trim();
  const cleanUsername = rawUsername.replace(/^@/, '');
  const lowerUsername = cleanUsername.toLowerCase();
  
  // 1. If explicit UID passed from URL/client
  let uid = '';
  if (params.uidParam && params.uidParam.trim().length >= 3) {
    uid = params.uidParam.trim().toUpperCase().slice(0, 16);
  }

  // --- Strict Role Security Check ---
  // 1. ตรวจสอบค่า role จาก URL parameter
  const rawRole = (params.role || '').toLowerCase().trim();
  const isRequestingAdmin = rawRole === 'admin' || rawRole === 'true' || rawRole === '1';

  // 2. เฉพาะกรณีที่ uid === "MED68001" หรือ "#MED68001" เท่านั้นที่จะยอมรับสิทธิ์ให้เป็น "admin" ได้
  const isValidAdminUid = uid === 'MED68001' || uid === '#MED68001';

  // 3. หากส่ง role=admin มาแต่ uid ไม่ใช่ "MED68001" ให้ทำการดาวน์เกรดเป็นผู้ใช้ทั่วไปทันที
  let validatedRole = 'user';
  let isAdmin = false;

  if (isValidAdminUid || (isRequestingAdmin && isValidAdminUid)) {
    validatedRole = 'admin';
    isAdmin = true;
  } else {
    // Downgraded or standard user
    validatedRole = 'user';
    isAdmin = false;
  }

  // กำหนดค่า UID ขั้นสุดท้าย
  const finalUid = uid || (cleanUsername ? generateHash8(cleanUsername + '_mt') : generateRandomUid8());

  const registry = getRegisteredUsers();
  const existingUser = registry[finalUid] || findUserByUsername(cleanUsername);

  let needsAdminVerification = false;

  let userGroup = params.userGroupParam ? decodeURIComponent(params.userGroupParam).trim() : undefined;
  let academicYear = params.academicYearParam ? decodeURIComponent(params.academicYearParam).trim() : undefined;
  const faculty = params.facultyParam ? decodeURIComponent(params.facultyParam).trim() : undefined;
  const university = params.universityParam ? decodeURIComponent(params.universityParam).trim() : undefined;

  // Sanitize non-admins: if someone else has "Admin" or "ผู้ดูแลระบบ" in group, reset it
  if (!isAdmin) {
    if (userGroup && (userGroup.toLowerCase().includes('admin') || userGroup.includes('ผู้ดูแลระบบ'))) {
      userGroup = '';
    }
  } else {
    // Force admin groups for the real admin
    userGroup = '👑 Admin';
    academicYear = 'ปี 5+';
  }

  // Render badge securely
  const computedBadge = formatUserBadge({
    isAdmin,
    userGroup: userGroup || existingUser?.userGroup || (isAdmin ? '👑 Admin' : ''),
    academicYear: academicYear || existingUser?.academicYear || (isAdmin ? undefined : ''),
    username: cleanUsername,
    uid: finalUid
  });

  const cleanDisplayName = (existingUser?.name && existingUser.name !== cleanUsername)
    ? existingUser.name
    : (params.displayName ? decodeURIComponent(params.displayName).trim() : (existingUser?.name || (isAdmin ? 'Admin Bank' : cleanUsername)));

  const cleanAvatar = params.avatar 
    ? decodeURIComponent(params.avatar).trim() 
    : (existingUser?.avatar || (isAdmin 
        ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' 
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=cccccc`));

  const resolvedUser: SessionUser = {
    id: finalUid,
    uid: finalUid,
    username: isAdmin ? '👑Admin' : cleanUsername,
    name: isAdmin ? '👑 Admin' : cleanDisplayName,
    avatar: cleanAvatar,
    userGroup: userGroup || existingUser?.userGroup || (isAdmin ? '👑 Admin' : ''),
    academicYear: academicYear || existingUser?.academicYear || (isAdmin ? undefined : ''),
    faculty: faculty || existingUser?.faculty || '',
    university: university || existingUser?.university || '',
    badge: computedBadge,
    isAdmin,
    needsAdminVerification,
    joinedAt: existingUser?.joinedAt || new Date().toLocaleDateString('th-TH')
  };

  saveRegisteredUser(resolvedUser);
  return resolvedUser;
}

// Generate default notifications for user
export function getInitialNotifications(user: SessionUser | null): AppNotification[] {
  const uidStr = user ? maskUid(user.uid, user) : 'MT2026';
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
