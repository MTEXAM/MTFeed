import { SessionUser, AppNotification } from '../types';

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

export function getRegisteredUsers(): Record<string, SessionUser> {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed to load accounts registry', e);
    return {};
  }
}

export function saveRegisteredUser(user: SessionUser): void {
  try {
    const registry = getRegisteredUsers();
    registry[user.uid] = user;
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error('Failed to save account to registry', e);
  }
}

export function findUserByUsername(username: string): SessionUser | null {
  const registry = getRegisteredUsers();
  const clean = username.trim().toLowerCase().replace(/^@/, '');
  for (const uid in registry) {
    if (registry[uid].username.toLowerCase() === clean) {
      return registry[uid];
    }
  }
  return null;
}

export function deleteRegisteredUser(uidOrUsername: string): boolean {
  try {
    const registry = getRegisteredUsers();
    const clean = uidOrUsername.trim().toLowerCase().replace(/^@/, '');
    
    // Check if key is UID
    if (registry[uidOrUsername.toUpperCase()]) {
      delete registry[uidOrUsername.toUpperCase()];
      localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
      return true;
    }
    
    // Or find by username
    for (const uid in registry) {
      if (registry[uid].username.toLowerCase() === clean || registry[uid].uid.toLowerCase() === clean) {
        delete registry[uid];
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(registry));
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('Failed to delete user', e);
    return false;
  }
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
}): SessionUser {
  const cleanUsername = params.username.trim().replace(/^@/, '');
  const isAdmin = params.role === 'admin' || params.role === 'true' || params.role === '1' || cleanUsername.toLowerCase() === 'bank';
  
  // 1. If explicit 8-char UID passed from exam web
  let uid = '';
  if (params.uidParam && params.uidParam.trim().length >= 4) {
    uid = params.uidParam.trim().toUpperCase().slice(0, 8);
  }

  const registry = getRegisteredUsers();

  // If UID provided and exists in registry, load and merge
  if (uid && registry[uid]) {
    const existing = registry[uid];
    const updatedUser: SessionUser = {
      ...existing,
      username: cleanUsername || existing.username,
      name: params.displayName ? decodeURIComponent(params.displayName).trim() : existing.name,
      avatar: params.avatar ? decodeURIComponent(params.avatar).trim() : existing.avatar,
      isAdmin: isAdmin || existing.isAdmin
    };
    saveRegisteredUser(updatedUser);
    return updatedUser;
  }

  // If no UID or not in registry, check if username exists in registry
  const existingByUsername = findUserByUsername(cleanUsername);
  if (existingByUsername) {
    const updatedUser: SessionUser = {
      ...existingByUsername,
      uid: uid || existingByUsername.uid,
      name: params.displayName ? decodeURIComponent(params.displayName).trim() : existingByUsername.name,
      avatar: params.avatar ? decodeURIComponent(params.avatar).trim() : existingByUsername.avatar,
      isAdmin: isAdmin || existingByUsername.isAdmin
    };
    saveRegisteredUser(updatedUser);
    return updatedUser;
  }

  // Otherwise create new permanent user with 8-char UID
  const finalUid = uid || (cleanUsername.toLowerCase() === 'bank' ? 'BANK2026' : generateHash8(cleanUsername + '_mt'));
  const cleanDisplayName = params.displayName 
    ? decodeURIComponent(params.displayName).trim() 
    : (cleanUsername.toLowerCase() === 'bank' ? 'Admin Bank' : cleanUsername);
    
  const cleanAvatar = params.avatar 
    ? decodeURIComponent(params.avatar).trim() 
    : (isAdmin 
        ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' 
        : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUsername)}&backgroundColor=cccccc`);

  const newUser: SessionUser = {
    id: finalUid,
    uid: finalUid,
    username: cleanUsername,
    name: cleanDisplayName,
    avatar: cleanAvatar,
    isAdmin,
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
