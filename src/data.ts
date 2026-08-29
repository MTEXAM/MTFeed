import { Post, Trend, User } from './types';

export const currentUser: User = {
  id: 'u1',
  name: 'MT Student',
  username: 'mt_student_01',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MTStudent',
};

export const MOCK_USERS: Record<string, User> = {
  u2: {
    id: 'u2',
    name: 'พี่หมอแล็บใจดี',
    username: 'p_mor_lab',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MorLab',
    badge: '👑 Top Helper'
  },
  u3: {
    id: 'u3',
    name: 'เด็กหลังห้อง',
    username: 'sleepy_mt',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sleepy',
  },
  anon: {
    id: 'anon',
    name: 'นักเทคนิคการแพทย์นิรนาม',
    username: 'anonymous',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon&backgroundColor=cccccc',
  }
};

export const MOCK_TRENDS: Trend[] = [
  { id: 't1', tag: '#สอบสภาครั้งที่1', postCount: 1250 },
  { id: 't2', tag: '#เคมีคลินิก', postCount: 843 },
  { id: 't3', tag: '#ทริคจำเชื้อ', postCount: 520 },
  { id: 't4', tag: '#หาที่ฝึกงาน', postCount: 312 },
  { id: 't5', tag: '#บ่นเตรียมสอบ', postCount: 290 },
  { id: 't6', tag: '#โลหิตวิทยา', postCount: 245 },
  { id: 't7', tag: '#ถามโจทย์', postCount: 198 },
  { id: 't8', tag: '#จุลชีววิทยา', postCount: 175 },
];

export const MOCK_CATEGORIES = [
  { id: 'all', label: 'ฟีดทั้งหมด', icon: 'Home' },
  { id: 'mine', label: 'โพสต์ของฉัน', icon: 'User' },
  { id: 'bookmarks', label: 'รายการที่บันทึก', icon: 'Bookmark' },
];

export const INITIAL_POSTS: Post[] = [
  {
    id: 'p1',
    author: MOCK_USERS.u2,
    content: 'สรุปค่า Normal Range ของ CBC ที่ออกสอบบ่อยๆ ครับ เซฟเก็บไว้ดูหน้าห้องสอบได้เลย! ขอให้ทุกคนโชคดีกับการสอบสภาพรุ่งนี้นะครับ ✌️',
    image: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&q=80&w=1000',
    tags: ['#โลหิตวิทยา', '#สรุปอ่านสอบ', '#สอบสภาครั้งที่1'],
    createdAt: '2 ชั่วโมงที่แล้ว',
    stats: { replies: 12, reposts: 45, likes: 320, bookmarks: 156 }
  },
  {
    id: 'p2',
    author: MOCK_USERS.anon,
    isAnonymous: true,
    content: 'ข้อสอบข้อนี้ตอบอะไรครับ งงมากเลย ทำไมถึงตอบ A?\n"ผู้ป่วยเบาหวาน มีค่า Fasting Blood Sugar 150 mg/dL ควรตรวจอะไรเพิ่มเติมเพื่อดูการควบคุมน้ำตาลในระยะยาว?"',
    poll: {
      options: [
        { id: 'opt1', text: 'HbA1c', votes: 145 },
        { id: 'opt2', text: 'OGTT', votes: 12 },
        { id: 'opt3', text: 'Fructosamine', votes: 8 },
        { id: 'opt4', text: 'Urine Glucose', votes: 2 },
      ],
      expiresAt: 'เหลือเวลาอีก 12 ชั่วโมง',
      totalVotes: 167
    },
    tags: ['#เคมีคลินิก', '#ถามโจทย์'],
    createdAt: '4 ชั่วโมงที่แล้ว',
    stats: { replies: 5, reposts: 2, likes: 18, bookmarks: 4 }
  },
  {
    id: 'p3',
    author: MOCK_USERS.u3,
    content: 'อาจารย์บอกว่าจุลชีวะออกเยอะมาก อ่านยังไงให้จำเชื้อแกรมลบได้หมด ใครมีทริคเด็ดๆ แชร์หน่อยครับ จะตายแล้ววว 😭🦠',
    tags: ['#จุลชีววิทยา', '#บ่นเตรียมสอบ'],
    createdAt: '5 ชั่วโมงที่แล้ว',
    stats: { replies: 28, reposts: 15, likes: 89, bookmarks: 12 }
  }
];
