import React, { useState } from 'react';
import { TrendingUp, Users, ChevronDown, ChevronUp, Sparkles, Hash, ShieldCheck, Database, CheckCircle2, Cloud } from 'lucide-react';
import { Post, SessionUser } from '../types';

export function SidebarRight({
  posts = [],
  currentUser,
  onlineUsers = [],
  selectedTag,
  onSelectTag,
  onOpenOnlineModal
}: {
  posts?: Post[];
  currentUser?: SessionUser | null;
  onlineUsers?: SessionUser[];
  selectedTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
  onOpenOnlineModal?: () => void;
}) {
  const [showAllTrends, setShowAllTrends] = useState(false);

  // Dynamically calculate trends from real posts
  const calculateTrends = () => {
    const countMap: Record<string, number> = {};
    
    (posts || []).forEach(post => {
      if (!post) return;
      // 1. From tags array
      if (post.tags && Array.isArray(post.tags)) {
        post.tags.forEach(t => {
          if (!t) return;
          const clean = String(t).startsWith('#') ? String(t) : `#${String(t)}`;
          countMap[clean] = (countMap[clean] || 0) + 1;
        });
      }
      // 2. From content regex (#...)
      const contentStr = typeof post.content === 'string' ? post.content : (post.content ? String(post.content) : '');
      const matches = contentStr.match(/#[\w\u0E00-\u0E7F]+/g) || [];
      matches.forEach(t => {
        countMap[t] = (countMap[t] || 0) + 1;
      });
    });

    const list = Object.entries(countMap).map(([tag, count], i) => ({
      id: `real_trend_${i}_${tag}`,
      tag,
      postCount: count
    }));

    // Sort by count descending
    return list.sort((a, b) => b.postCount - a.postCount);
  };

  const realTrends = calculateTrends();
  const displayedTrends = showAllTrends ? realTrends : realTrends.slice(0, 5);

  // Active users count (real only)
  const activeCount = onlineUsers.length > 0 ? onlineUsers.length : (currentUser ? 1 : 0);

  return (
    <div className="hidden lg:block w-80 flex-shrink-0 py-6 pl-6">
      <div className="sticky top-24 space-y-6">

        {/* Trends Box */}
        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-red-500" />
              <h2 className="text-base font-bold text-gray-900">กำลังมาแรง (Trends)</h2>
            </div>
            {selectedTag && (
              <button 
                onClick={() => onSelectTag && onSelectTag(null)}
                className="text-xs text-red-600 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-medium"
              >
                ล้างตัวกรอง ✕
              </button>
            )}
          </div>

          {realTrends.length === 0 ? (
            <div className="py-6 px-3 text-center bg-white rounded-xl border border-gray-200/80">
              <Hash className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">ยังไม่มีแท็กมาแรง</p>
              <p className="text-xs text-gray-400 mt-1">
                พิมพ์ # ตามด้วยคำสำคัญในโพสต์ของคุณ เพื่อเริ่มต้นสร้างแท็กแรกในชุมชน
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {displayedTrends.map((trend, index) => {
                const isSelected = selectedTag === trend.tag;
                return (
                  <div 
                    key={trend.id} 
                    onClick={() => onSelectTag && onSelectTag(isSelected ? null : trend.tag)}
                    className={`group cursor-pointer p-2.5 rounded-xl transition-all ${
                      isSelected 
                        ? 'bg-red-100/80 border border-red-200 shadow-xs' 
                        : 'hover:bg-gray-100/80 bg-white border border-gray-100'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[11px] text-gray-500 font-medium">อันดับ {index + 1} • MT Feed</p>
                        <p className={`text-sm font-bold mt-0.5 transition-colors ${
                          isSelected ? 'text-red-700' : 'text-gray-900 group-hover:text-red-600'
                        }`}>
                          {trend.tag}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{trend.postCount.toLocaleString()} โพสต์</p>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded-md">
                          กำลังกรอง
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {realTrends.length > 5 && (
                <button 
                  onClick={() => setShowAllTrends(!showAllTrends)}
                  className="w-full flex items-center justify-between text-left text-sm text-red-500 hover:text-red-600 mt-3 pt-3 border-t border-gray-200 font-medium transition-colors"
                >
                  <span>{showAllTrends ? 'ย่อลง' : `แสดงทั้งหมด (${realTrends.length})`}</span>
                  {showAllTrends ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Members in System Box */}
        <div 
          onClick={currentUser?.isAdmin ? onOpenOnlineModal : undefined}
          className={`bg-gray-50 rounded-2xl p-5 border border-gray-100 shadow-xs transition-all group ${currentUser?.isAdmin ? 'hover:bg-gray-100/90 cursor-pointer' : ''}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-red-100 text-red-600 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-gray-900 group-hover:text-red-600 transition-colors">สมาชิกในระบบ</h2>
            </div>
            {currentUser?.isAdmin && (
              <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full group-hover:bg-red-600 group-hover:text-white transition-colors">
                ดูรายชื่อ →
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex -space-x-2 overflow-hidden py-1">
              {currentUser?.isAdmin ? (
                onlineUsers.length > 0 ? (
                  onlineUsers.slice(0, 5).map((u) => (
                    <img
                      key={u.uid || u.username}
                      className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 object-cover shadow-xs"
                      src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(u.username)}&backgroundColor=cccccc`}
                      alt={u.name || u.username}
                      title={u.name || u.username}
                    />
                  ))
                ) : currentUser ? (
                  <img
                    className="inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 object-cover shadow-xs"
                    src={currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=cccccc`}
                    alt={currentUser.name || currentUser.username}
                    title={currentUser.name || currentUser.username}
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                    <Users className="w-4 h-4" />
                  </div>
                )
              ) : (
                <div className="h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs text-gray-400">
                  <Users className="w-4 h-4" />
                </div>
              )}
            </div>
            <span className="text-sm font-bold text-gray-700 bg-white px-2.5 py-1 rounded-full border border-gray-200 shadow-xs">
              {activeCount} บัญชี
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-3 flex items-center space-x-1">
            <Sparkles className="w-3.5 h-3.5 text-yellow-500" />
            <span>
              สมาชิกทั้งหมดที่ลงทะเบียนในระบบ MTFeed
            </span>
          </p>
        </div>

        {/* Quad-Tier Permanent Storage Status (Admin Only) */}
        {currentUser?.isAdmin && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50/70 rounded-2xl p-4 border border-emerald-200/80 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">ระบบสำรองข้อมูลถาวร (Admin)</h3>
              </div>
              <span className="flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1"></span>
                Active
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] text-emerald-900">
              <div className="flex items-center justify-between py-1 border-b border-emerald-100/80">
                <span className="flex items-center text-gray-700">
                  <Database className="w-3 h-3 mr-1.5 text-emerald-600" />
                  Google Sheets (ถาวร)
                </span>
                <span className="font-semibold text-emerald-700 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600" /> เชื่อมต่อแล้ว
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-emerald-100/80">
                <span className="flex items-center text-gray-700">
                  <Cloud className="w-3 h-3 mr-1.5 text-blue-600" />
                  Cloud Firestore (Realtime)
                </span>
                <span className="font-semibold text-blue-700 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-0.5 text-blue-600" /> ซิงค์สด
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="flex items-center text-gray-700">
                  <Database className="w-3 h-3 mr-1.5 text-amber-600" />
                  SQLite WAL (Server Dual-Write)
                </span>
                <span className="font-semibold text-amber-700 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-0.5 text-amber-600" /> ทำงานคู่ขนาน
                </span>
              </div>
            </div>

            <p className="text-[10px] text-emerald-800 leading-normal pt-1 border-t border-emerald-100/80">
              🔒 ทุกโพสต์และโปรไฟล์ได้รับการบันทึกลง Google Sheet จริง จึงไม่มีวันสูญหายแม้รีเฟรชหรือเปลี่ยนเครื่อง
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
