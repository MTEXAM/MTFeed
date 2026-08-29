import React, { useState } from 'react';
import { X, Bell, Heart, MessageSquare, ShieldCheck, Sparkles, AtSign, Check, CheckCheck, Trash2 } from 'lucide-react';
import { AppNotification, SessionUser } from '../types';
import { formatRelativeOrRealTime } from '../utils/timeUtils';
import { maskUid } from '../utils/auth';

export function NotificationsModal({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onSelectNotification,
  user
}: {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectNotification?: (notif: AppNotification) => void;
  user: SessionUser | null;
}) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'system'>('all');

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'system') return item.type === 'system' || item.type === 'badge';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-blue-500 fill-blue-100" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-purple-500" />;
      case 'badge':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'system':
      default:
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg leading-tight">การแจ้งเตือน</h3>
                {unreadCount > 0 && (
                  <span className="bg-white text-red-600 text-xs px-2 py-0.5 rounded-full font-bold shadow-xs">
                    {unreadCount} ใหม่
                  </span>
                )}
              </div>
              <p className="text-xs text-red-100 mt-0.5">
                {user ? `อัปเดตกิจกรรมของ @${user.username} (UID: #${maskUid(user.uid, user)})` : 'ความเคลื่อนไหวและข่าวสารล่าสุด'}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs & Quick Actions */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs flex-shrink-0">
          <div className="flex space-x-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'all' 
                  ? 'bg-red-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              ทั้งหมด ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'unread' 
                  ? 'bg-red-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              ยังไม่อ่าน ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('system')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'system' 
                  ? 'bg-red-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              ระบบ & ความปลอดภัย
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-red-600 hover:text-red-700 font-semibold flex items-center space-x-1 py-1 px-2 rounded hover:bg-red-50"
              title="อ่านแล้วทั้งหมด"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">อ่านทั้งหมด</span>
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="p-3 overflow-y-auto divide-y divide-gray-100 flex-1">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">ไม่มีการแจ้งเตือนในหมวดนี้</p>
              <p className="text-xs text-gray-400 mt-1">เมื่อมีเพื่อนตอบกลับ ถูกใจ หรือมีประกาศ จะแสดงที่นี่</p>
            </div>
          ) : (
            filteredNotifications.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.read) onMarkAsRead(item.id);
                  if (onSelectNotification) onSelectNotification(item);
                }}
                className={`p-3 rounded-xl transition-all cursor-pointer flex items-start space-x-3 my-1 ${
                  item.read 
                    ? 'hover:bg-gray-50 bg-white opacity-85' 
                    : 'bg-red-50/60 hover:bg-red-50 border border-red-100 shadow-xs'
                }`}
              >
                {/* Avatar / Icon Container */}
                <div className="relative flex-shrink-0 mt-0.5">
                  {item.authorAvatar ? (
                    <img 
                      src={item.authorAvatar} 
                      alt="" 
                      className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-xs" 
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                      {getIcon(item.type)}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
                    {getIcon(item.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {item.title}
                    </p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {formatRelativeOrRealTime(item.createdAtMs, item.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Read indicator dot */}
                {!item.read && (
                  <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0 mt-2"></span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 flex-shrink-0">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            <span>แจ้งเตือนแบบเรียลไทม์</span>
          </div>

          <div className="flex space-x-2">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 text-gray-500 hover:text-red-600 font-medium hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ล้างทั้งหมด</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
            >
              ปิด
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
