import React from 'react';
import { BookA, MessageSquare, Bell, Search, Settings, User, Shield, Award, Camera, Edit3, LogOut } from 'lucide-react';
import { SessionUser } from '../types';
import { getBadgeStyle, formatUserBadge, maskUid } from '../utils/auth';

export function Navbar({ 
  user, 
  onLoginClick, 
  onAdminClick,
  onEditProfileClick,
  onViewProfile,
  onLogoutClick,
  searchQuery,
  onSearchChange,
  unreadCount = 0,
  onOpenNotifications,
  onExternalLinkClick
}: { 
  user: SessionUser | null;
  onLoginClick: () => void;
  onAdminClick?: () => void;
  onEditProfileClick?: () => void;
  onViewProfile?: (user: SessionUser) => void;
  onLogoutClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  unreadCount?: number;
  onOpenNotifications?: () => void;
  onExternalLinkClick?: (url: string) => void;
}) {
  const handleExamClick = (e: React.MouseEvent) => {
    const url = "https://mtexam-passalldiwa.ai.studio/";
    if (onExternalLinkClick) {
      e.preventDefault();
      onExternalLinkClick(url);
    }
  };

  const badgeText = user ? (user.badge || formatUserBadge(user)) : '';
  const badgeStyle = getBadgeStyle(badgeText);
  const educationDetail = user ? [user.faculty, user.university].filter(Boolean).join(' • ') : '';

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-xl font-bold text-red-600">MT<span className="text-black">Feed</span></span>
            </div>
            <div className="ml-4 flex space-x-4 md:ml-6 md:space-x-8">
              <span className="inline-flex items-center px-1 pt-1 border-b-2 border-red-600 text-sm font-medium text-gray-900">
                <MessageSquare className="w-4 h-4 mr-1 sm:mr-2 text-red-600" />
                หน้าฟีด
              </span>
              {user?.isAdmin && (
                <span onClick={onAdminClick} className="inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium text-gray-500 hover:text-gray-700 cursor-pointer">
                  <Settings className="w-4 h-4 mr-1 sm:mr-2" />
                  แอดมินบอร์ด
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <a 
              href="https://mtexam-passalldiwa.ai.studio/"
              onClick={handleExamClick}
              className="inline-flex items-center px-3.5 py-1.5 sm:px-4 sm:py-2 border border-red-600 text-xs sm:text-sm font-semibold rounded-full text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 transition-colors"
              title="ไปยังเว็บคลังข้อสอบ MTExam"
            >
              <BookA className="w-4 h-4 mr-1.5 text-red-600" />
              <span>คลังข้อสอบ</span>
            </a>

            <div className="hidden lg:block relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text" 
                value={searchQuery || ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="ค้นหาโพสต์, แท็ก หรือชื่อผู้ใช้..."
                className="block w-64 pl-10 pr-8 py-1.5 border border-gray-300 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-red-600 focus:border-red-600 sm:text-sm transition-all focus:w-80"
              />
              {searchQuery && (
                <button 
                  onClick={() => onSearchChange?.('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
            
            {/* Notification Bell Button (Desktop & Mobile) */}
            <button 
              onClick={onOpenNotifications}
              className="relative p-2 text-gray-500 hover:text-red-600 focus:outline-none rounded-full hover:bg-gray-100 transition-colors"
              title="การแจ้งเตือน"
            >
              <Bell className="h-5 w-5 sm:h-6 sm:w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-600 rounded-full ring-2 ring-white animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            
            {user ? (
              <>
                <div className="relative flex-shrink-0 group">
                  <button 
                    onClick={onEditProfileClick}
                    className="bg-white rounded-full flex items-center space-x-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 p-1 hover:bg-gray-50 transition-colors cursor-pointer"
                    title="คลิกเพื่อแก้ไขโปรไฟล์ / รูปโปรไฟล์"
                  >
                    <div className="relative">
                      <img 
                        className="h-8 w-8 rounded-full bg-gray-100 border border-gray-200 object-cover" 
                        src={user.avatar || (user.isAdmin ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=cccccc`)} 
                        alt="Profile" 
                      />
                      <span className="absolute -bottom-0.5 -right-0.5 bg-red-600 text-white p-0.5 rounded-full ring-1 ring-white">
                        <Camera className="w-2 h-2" />
                      </span>
                    </div>
                    <div className="hidden md:flex flex-col text-left">
                      <span className="font-semibold text-xs text-gray-800 max-w-[100px] truncate leading-tight">
                        {user.name || user.username}
                      </span>
                      {badgeText && (
                        <span className="text-[10px] text-gray-500 truncate max-w-[110px]">
                          {badgeText}
                        </span>
                      )}
                    </div>
                  </button>
                  {/* Dropdown Profile without logout */}
                  <div className="absolute right-0 w-72 mt-2 origin-top-right bg-white border border-gray-200 divide-y divide-gray-100 rounded-2xl shadow-xl outline-none opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-gray-500 font-medium">บัญชีผู้ใช้ MTFeed</p>
                        <button
                          onClick={onEditProfileClick}
                          className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center hover:underline cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 mr-1" />
                          แก้ไข
                        </button>
                      </div>
                      <p className="text-sm font-bold text-gray-900 truncate mt-0.5">{user.name || user.username}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-500 truncate">@{user.username}</span>
                        <span className="text-[10px] font-mono bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-semibold" title="รหัสความปลอดภัยประจำตัว (โปรดเก็บเป็นความลับ)">
                          UID: #{maskUid(user.uid, user)}
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center">
                        <Shield className="w-2.5 h-2.5 mr-1 text-amber-600" />
                        โปรดเก็บ UID เป็นความลับเพื่อความปลอดภัย
                      </p>
                      {badgeText && (
                        <div className="mt-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                            {badgeText}
                          </span>
                        </div>
                      )}

                    </div>
                    <div className="py-1">
                      <button 
                        onClick={() => {
                          if (onViewProfile && user) {
                            onViewProfile(user);
                          }
                        }}
                        className="w-full flex items-center px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer font-medium"
                      >
                        <User className="w-4 h-4 mr-2 text-gray-500" />
                        ดูโปรไฟล์และโพสต์ของฉัน
                      </button>
                      <button 
                        onClick={onEditProfileClick}
                        className="w-full flex items-center px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer font-medium"
                      >
                        <Camera className="w-4 h-4 mr-2 text-gray-500" />
                        เปลี่ยนรูปโปรไฟล์ / แก้ไขข้อมูล
                      </button>
                      <button 
                        onClick={onOpenNotifications}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center font-medium">
                          <Bell className="w-4 h-4 mr-2 text-gray-500" />
                          การแจ้งเตือนของฉัน
                        </span>
                        {unreadCount > 0 && (
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            {unreadCount}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="py-1 border-t border-gray-100">
                      <button 
                        onClick={onLogoutClick}
                        className="w-full flex items-center px-4 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors cursor-pointer font-medium"
                      >
                        <LogOut className="w-4 h-4 mr-2 text-red-500" />
                        ออกจากระบบ (Logout)
                      </button>
                    </div>
                    <div className="px-4 py-2 bg-gray-50 text-[11px] text-gray-500 flex items-center space-x-1.5 rounded-b-2xl">
                      <Shield className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                      <span>เชื่อมต่อบัญชีอัตโนมัติจาก MTExam</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex space-x-2">
                <a href="https://mtexam-passalldiwa.ai.studio/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full text-red-600 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors">
                  <User className="w-4 h-4 mr-2" />
                  เข้าสู่ระบบ
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
