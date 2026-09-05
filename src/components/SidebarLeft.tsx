import React from 'react';
import { MOCK_CATEGORIES } from '../data';
import * as Icons from 'lucide-react';
import { SessionUser } from '../types';
import { getBadgeStyle, formatUserBadge, maskUid, MAIN_SITE_URL, sanitizeDisplayName, sanitizeUsername } from '../utils/auth';

export function SidebarLeft({ 
  activeCategory, 
  setActiveCategory,
  unreadCount = 0,
  onOpenNotifications,
  onEditProfileClick,
  onViewProfile,
  onLogoutClick,
  currentUser
}: { 
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onEditProfileClick?: () => void;
  onViewProfile?: (user: SessionUser) => void;
  onLogoutClick?: () => void;
  currentUser?: SessionUser | null;
}) {
  const badgeText = currentUser ? (formatUserBadge(currentUser)) : '';
  const badgeStyle = getBadgeStyle(badgeText);


  return (
    <div className="hidden md:block w-64 flex-shrink-0 py-6 pr-6">
      <div className="sticky top-24 space-y-4">

        {/* Current User Mini Profile Card */}
        {currentUser && (
          <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs mb-4">
            <div className="flex items-center space-x-3">
              <div 
                className="relative group cursor-pointer" 
                onClick={() => onViewProfile ? onViewProfile(currentUser) : onEditProfileClick?.()} 
                title="คลิกเพื่อดูโปรไฟล์ของคุณ"
              >
                <img 
                  src={currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=cccccc`} 
                  alt={currentUser.username}
                  className="w-10 h-10 rounded-full bg-gray-100 object-cover border border-gray-200 group-hover:ring-2 group-hover:ring-red-400 transition-all"
                />
                <span className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icons.User className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onViewProfile ? onViewProfile(currentUser) : onEditProfileClick?.()}
                    className="text-xs font-bold text-gray-900 truncate hover:text-red-600 hover:underline cursor-pointer text-left"
                    title="คลิกเพื่อดูโปรไฟล์"
                  >
                    {sanitizeDisplayName(currentUser.name, currentUser.uid, currentUser.isAdmin)}
                  </button>
                  <button
                    onClick={onEditProfileClick}
                    className="text-[10px] text-red-600 hover:text-red-700 font-semibold flex items-center cursor-pointer ml-1"
                    title="แก้ไขโปรไฟล์"
                  >
                    <Icons.Edit3 className="w-3 h-3 mr-0.5" />
                    แก้ไข
                  </button>
                </div>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="text-[11px] text-gray-500 truncate">@{sanitizeUsername(currentUser.username, currentUser.uid, currentUser.isAdmin)}</span>
                </div>
              </div>
            </div>

            {badgeText && (
              <div className="mt-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                  {badgeText}
                </span>
              </div>
            )}




            <div className="flex items-center space-x-2 mt-3">
              <button
                onClick={() => onViewProfile ? onViewProfile(currentUser) : onEditProfileClick?.()}
                className="flex-1 py-1.5 px-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-[11px] font-semibold border border-gray-200/80 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Icons.User className="w-3 h-3" />
                <span>โปรไฟล์ฉัน</span>
              </button>
              
              <button
                onClick={onLogoutClick}
                className="flex-1 py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-semibold border border-red-100 transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                title="ออกจากระบบ"
              >
                <Icons.LogOut className="w-3 h-3" />
                <span>ออกจากระบบ</span>
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
              <span className="flex items-center">
                <Icons.ShieldCheck className="w-3 h-3 mr-1 text-green-500" />
                เชื่อมต่อระบบความปลอดภัย MTFeed
              </span>
            </div>
          </div>
        )}

        <nav className="space-y-1">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            หมวดหมู่ / แท็ก
          </h3>

          {/* Quick Notifications Button */}
          <button
            onClick={onOpenNotifications}
            className="w-full group flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors mb-2"
          >
            <div className="flex items-center">
              <Icons.Bell className="flex-shrink-0 -ml-1 mr-3 h-5 w-5 text-gray-400 group-hover:text-red-500 transition-colors" />
              <span>การแจ้งเตือน</span>
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {MOCK_CATEGORIES.map((category) => {
            const Icon = (Icons as any)[category.icon];
            const isActive = activeCategory === category.id;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`w-full group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-colors ${
                  isActive
                    ? 'bg-red-50 text-red-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                {Icon && (
                  <Icon
                    className={`flex-shrink-0 -ml-1 mr-3 h-5 w-5 transition-colors ${
                      isActive ? 'text-red-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`}
                  />
                )}
                <span className="truncate">{category.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 px-1">
          <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-4 border border-red-100 shadow-sm">
            <div className="flex items-center space-x-2 text-red-800 font-bold mb-1.5">
              <Icons.BookA className="w-5 h-5 text-red-600" />
              <h4 className="text-sm">คลังข้อสอบ MT</h4>
            </div>
            <p className="text-xs text-gray-600 mb-3 leading-relaxed">
              ฝึกทำข้อสอบวิชาชีพเทคนิคการแพทย์ ทำแบบทดสอบจำลองได้ที่นี่
            </p>
            <a 
              href={MAIN_SITE_URL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-white text-red-600 border border-red-200 py-2 px-4 rounded-xl text-xs font-bold hover:bg-red-50 hover:border-red-300 shadow-sm transition-all"
            >
              ไปยังเว็บทำข้อสอบ ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
