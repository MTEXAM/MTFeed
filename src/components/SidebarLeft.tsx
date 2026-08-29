import React from 'react';
import { MOCK_CATEGORIES } from '../data';
import * as Icons from 'lucide-react';
import { SessionUser } from '../types';
import { getBadgeStyle, formatUserBadge } from '../utils/auth';

export function SidebarLeft({ 
  activeCategory, 
  setActiveCategory,
  unreadCount = 0,
  onOpenNotifications,
  currentUser,
  onEditProfile
}: { 
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  unreadCount?: number;
  onOpenNotifications?: () => void;
  currentUser?: SessionUser | null;
  onEditProfile?: () => void;
}) {
  const badgeText = currentUser ? (currentUser.badge || formatUserBadge(currentUser)) : '';
  const badgeStyle = getBadgeStyle(badgeText);
  const edu = currentUser ? [currentUser.faculty, currentUser.university].filter(Boolean).join(' • ') : '';

  return (
    <div className="hidden md:block w-64 flex-shrink-0 py-6 pr-6">
      <div className="sticky top-24 space-y-4">

        {/* Current User Mini Profile Card */}
        {currentUser && (
          <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-xs mb-4">
            <div className="flex items-center space-x-3">
              <img 
                src={currentUser.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=cccccc`} 
                alt={currentUser.username}
                className="w-10 h-10 rounded-full bg-gray-100 object-cover border border-gray-200"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {currentUser.name || currentUser.username}
                </p>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span className="text-[11px] text-gray-500 truncate">@{currentUser.username}</span>
                  <span className="text-[9px] font-mono bg-gray-100 text-gray-600 px-1 py-0.2 rounded border border-gray-200">
                    #{currentUser.uid}
                  </span>
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

            {edu && (
              <p className="text-[10px] text-gray-500 mt-1 truncate" title={edu}>
                🏛️ {edu}
              </p>
            )}

            {onEditProfile && (
              <button
                onClick={onEditProfile}
                className="w-full mt-3 py-1 px-2 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100/80 rounded-lg transition-colors flex items-center justify-center space-x-1"
              >
                <Icons.Edit3 className="w-3 h-3" />
                <span>แก้ไขสถานะการศึกษา</span>
              </button>
            )}
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
              href="https://mtexam-passalldiwa.ai.studio/" 
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
