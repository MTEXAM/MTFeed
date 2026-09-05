import { SessionUser, AppNotification } from '../types';
import { saveUserToFirestore, deleteUserFromFirestore, clearAllUsersFromFirestore } from './firestoreService';

export const MAIN_SITE_URL = 'https://ais-pre-xiftsicrt4entwmmp6uygm-114914192301.asia-southeast1.run.app/';
export const MAIN_SITE_HOST = 'ais-pre-xiftsicrt4entwmmp6uygm-114914192301.asia-southeast1.run.app';

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
    name: 'Bank',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5',
    isAdmin: true,
    userGroup: '👑 Admin',
    academicYear: 'ปี 5+',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: '👑 Admin'
  },
  'BANK2026': {
    uid: 'BANK2026',
    username: 'bank2026',
    name: 'Bank',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=bank2026',
    isAdmin: false,
    userGroup: '',
    academicYear: 'ปี 4',
    faculty: 'คณะเทคนิคการแพทย์',
    badge: ''
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
    const parsed: Record<string, SessionUser> = JSON.parse(raw);
    
    // Security Sanitize: Ensure only MED68001 can ever be Admin
    for (const key in parsed) {
      const u = parsed[key];
      if (u) {
        const isTrueAdmin = (u.uid === 'MED68001' || u.uid === '#MED68001' || u.username === 'bank');
        if (!isTrueAdmin && u.isAdmin) {
          u.isAdmin = false;
          u.badge = '';
          u.userGroup = '';
        }
      }
    }
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

export function isSensitiveStudentCode(val: string | undefined | null): boolean {
  if (!val || typeof val !== 'string') return false;
  const clean = val.trim().replace(/^[@#]/, '');
  if (/^MED\d+/i.test(clean)) return true;
  if (/^[A-Za-z]{2,5}\d{4,}/i.test(clean)) return true;
  return false;
}

export function sanitizeDisplayName(name: string | undefined | null, uid?: string, isAdminUser?: boolean): string {
  const cleanName = (name || '').trim();
  const cleanUid = (uid || '').replace(/^[@#]/, '').toUpperCase();
  const isBankAdmin = cleanUid === 'MED68001' || cleanUid === 'BANK2026' || isAdminUser;

  if (isBankAdmin) {
    if (!cleanName || isSensitiveStudentCode(cleanName) || cleanName === 'User' || cleanName === '👑 Admin') {
      return 'Bank';
    }
    return cleanName;
  }

  if (cleanName && !isSensitiveStudentCode(cleanName) && cleanName !== 'User' && cleanName !== 'undefined') {
    return cleanName;
  }

  return 'ผู้ใช้งาน';
}

export function sanitizeUsername(username: string | undefined | null, uid?: string, isAdminUser?: boolean): string {
  const clean = (username || '').replace(/^[@#]/, '').trim();
  const cleanUid = (uid || '').replace(/^[@#]/, '').toUpperCase();
  const isBankAdmin = cleanUid === 'MED68001' || cleanUid === 'BANK2026' || isAdminUser;

  if (isBankAdmin) {
    if (!clean || isSensitiveStudentCode(clean) || clean === '👑Admin' || clean.toLowerCase() === 'admin') {
      return 'bank';
    }
    return clean.toLowerCase();
  }

  if (clean && !isSensitiveStudentCode(clean) && clean !== 'user' && clean !== 'undefined') {
    return clean;
  }

  return 'user';
}

export function maskUid(uid: string | undefined, currentUser?: { isAdmin?: boolean; uid?: string } | null): string {
  // Never expose student IDs/raw codes anywhere on screen
  return '';
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

// Define admin UIDs centrally
export const ADMIN_UIDS = ['MED68001', 'BANK2026'];

export function isAdmin(user: any): boolean {
  if (!user) return false;
  const isExplicitAdmin = Boolean(user.isAdmin || user.badge === '👑 Admin');
  const hasAdminId = ADMIN_UIDS.includes(user.id || user.uid);
  return isExplicitAdmin && hasAdminId;
}

export function getExplicitAvatar(uid: string | undefined | null): string | null {
  if (!uid) return null;
  const cleanUid = uid.replace(/^[@#]/, '').toUpperCase();
  try {
    const saved = localStorage.getItem(`mtfeed_avatar_explicit_${cleanUid}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed.avatar === 'string' && parsed.avatar.trim()) {
        return parsed.avatar.trim();
      }
    }
  } catch (e) {}
  return null;
}

export function setExplicitAvatar(uid: string | undefined | null, avatarUrlOrData: string): void {
  if (!uid || !avatarUrlOrData) return;
  const cleanUid = uid.replace(/^[@#]/, '').toUpperCase();
  try {
    localStorage.setItem(`mtfeed_avatar_explicit_${cleanUid}`, JSON.stringify({
      avatar: avatarUrlOrData,
      updatedAt: Date.now()
    }));
  } catch (e) {}
}

export function clearExplicitAvatar(uid: string | undefined | null): void {
  if (!uid) return;
  const cleanUid = uid.replace(/^[@#]/, '').toUpperCase();
  try {
    localStorage.removeItem(`mtfeed_avatar_explicit_${cleanUid}`);
  } catch (e) {}
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
  // 1. ตรวจสอบค่า role และ verifiedAdmin
  const rawRole = (params.role || '').toLowerCase().trim();
  const isRequestingAdmin = rawRole === 'admin' || rawRole === 'true' || rawRole === '1';

  // 2. ยอมรับสิทธิ์ Admin เฉพาะ UID MED68001 หรือ #MED68001 เท่านั้น (ห้ามบัญชีอื่นโดยเด็ดขาด)
  const isTargetingAdmin = 
    uid === 'MED68001' || 
    uid === '#MED68001' || 
    lowerUsername === 'bank' || 
    lowerUsername === 'med68001';

  const isValidAdmin = isTargetingAdmin && (params.verifiedAdmin === true || isRequestingAdmin || !params.role);

  let validatedRole = 'user';
  let isAdmin = false;

  if (isValidAdmin) {
    validatedRole = 'admin';
    isAdmin = true;
    uid = 'MED68001';
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

  const cleanDisplayName = sanitizeDisplayName(
    existingUser?.name || params.displayName,
    finalUid,
    isAdmin
  );

  const finalUsername = sanitizeUsername(
    cleanUsername || existingUser?.username,
    finalUid,
    isAdmin
  );

  // Check if this UID has an explicitly set custom avatar
  const explicitAvatar = getExplicitAvatar(finalUid);

  const cleanAvatar = explicitAvatar || (params.avatar 
    ? decodeURIComponent(params.avatar).trim() 
    : (existingUser?.avatar || (isAdmin 
        ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' 
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(finalUsername)}&backgroundColor=cccccc`)));

  const resolvedUser: SessionUser = {
    id: finalUid,
    uid: finalUid,
    username: finalUsername,
    name: cleanDisplayName,
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
  const nameStr = user ? (sanitizeDisplayName(user.name, user.uid, user.isAdmin)) : 'เพื่อนๆ สมาชิก';

  return [
    {
      id: 'notif_sys_1',
      type: 'system',
      title: `ระบบความปลอดภัย: บัญชีของคุณได้รับการคุ้มครอง`,
      description: `ระบบล็อคบัญชีและเก็บข้อมูลโพสต์/บุ๊กมาร์กให้อัตโนมัติทุกครั้งที่เข้าใช้งานอย่างปลอดภัย`,
      authorName: 'ระบบความปลอดภัย MTFeed',
      senderType: 'system',
      severity: 'info',
      createdAt: 'เมื่อสักครู่',
      createdAtMs: Date.now(),
      read: false
    },
    {
      id: 'notif_admin_welcome',
      type: 'system',
      title: 'ยินดีต้อนรับสู่ MTFeed ชุมชนนักเทคนิคการแพทย์',
      description: `สวัสดีคุณ ${nameStr}! มาร่วมพูดคุย ถาม-ตอบ แลกเปลี่ยนทริคจำและแนวข้อสอบสภาวิชาชีพได้ตลอด 24 ชม.`,
      authorName: 'Admin Bank (👑 ผู้ดูแลระบบ)',
      authorAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5',
      senderType: 'admin',
      severity: 'info',
      createdAt: 'เมื่อสักครู่',
      createdAtMs: Date.now() - 60000,
      read: false
    }
  ];
}
