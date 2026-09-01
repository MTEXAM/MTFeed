import React, { useState } from 'react';
import { X, Bell, Heart, MessageSquare, ShieldCheck, Sparkles, AtSign, Check, CheckCheck, Trash2, ShieldAlert, AlertTriangle, Info, Megaphone } from 'lucide-react';
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
  user,
  onOpenAdminBroadcast
}: {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onSelectNotification?: (notif: AppNotification) => void;
  user: SessionUser | null;
  onOpenAdminBroadcast?: () => void;
}) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'system'>('all');

  if (!isOpen) return null;

  const filteredNotifications = notifications.filter((item) => {
    if (filter === 'unread') return !item.read;
    if (filter === 'system') return item.type === 'system' || item.type === 'badge' || item.senderType === 'admin' || item.senderType === 'system';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const systemCount = notifications.filter(item => item.type === 'system' || item.type === 'badge' || item.senderType === 'admin' || item.senderType === 'system').length;

  const getIcon = (item: AppNotification) => {
    if (item.type === 'system' || item.senderType === 'system' || item.senderType === 'admin') {
      if (item.severity === 'alert') return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      if (item.severity === 'warning') return <ShieldAlert className="w-4 h-4 text-amber-600" />;
      if (item.severity === 'success') return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
      if (item.senderType === 'admin') return <Megaphone className="w-4 h-4 text-red-600" />;
      return <ShieldCheck className="w-4 h-4 text-blue-600" />;
    }

    switch (item.type) {
      case 'like':
        return <Heart className="w-4 h-4 text-red-500 fill-red-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-blue-500 fill-blue-100" />;
      case 'mention':
        return <AtSign className="w-4 h-4 text-purple-500" />;
      case 'badge':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getSeverityBadge = (item: AppNotification) => {
    if (item.senderType === 'admin') {
      return (
        <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.2 rounded border border-red-200 inline-flex items-center space-x-1">
          <span>👑</span>
          <span>ส่งโดย แอดมิน</span>
        </span>
      );
    }
    if (item.senderType === 'system') {
      return (
        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200 inline-flex items-center space-x-1">
          <span>🛡️</span>
          <span>ระบบอัตโนมัติ AI Sentinel</span>
        </span>
      );
    }
    if (item.severity === 'alert') {
      return (
        <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded border border-rose-200">
          🔴 ขัดข้อง/ฉุกเฉิน
        </span>
      );
    }
    if (item.severity === 'warning') {
      return (
        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200">
          🟡 แจ้งเตือนความปลอดภัย
        </span>
      );
    }
    return null;
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
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs & Quick Actions */}
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs flex-shrink-0 overflow-x-auto">
          <div className="flex space-x-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'all' 
                  ? 'bg-red-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              ทั้งหมด ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'unread' 
                  ? 'bg-red-600 text-white shadow-xs' 
                  : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              ยังไม่อ่าน ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('system')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1 ${
                filter === 'system' 
                  ? 'bg-red-600 text-white shadow-xs' 
                  : 'bg-white text-red-700 hover:bg-red-50 border border-red-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ระบบ & ความปลอดภัย ({systemCount})</span>
            </button>
          </div>

          <div className="flex items-center space-x-2 ml-2">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                className="text-red-600 hover:text-red-700 font-semibold flex items-center space-x-1 py-1 px-2 rounded hover:bg-red-50 cursor-pointer whitespace-nowrap"
                title="อ่านแล้วทั้งหมด"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">อ่านทั้งหมด</span>
              </button>
            )}
          </div>
        </div>

        {/* Admin Broadcast Quick Banner */}
        {user?.isAdmin && onOpenAdminBroadcast && (
          <div className="px-4 py-2 bg-gradient-to-r from-red-50 to-orange-50 border-b border-red-100 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1.5 text-red-900 font-semibold">
              <Megaphone className="w-3.5 h-3.5 text-red-600" />
              <span>👑 สิทธิ์แอดมิน: ต้องการส่งประกาศเตือนความปลอดภัย?</span>
            </div>
            <button
              onClick={() => {
                onClose();
                onOpenAdminBroadcast();
              }}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] transition-colors shadow-2xs cursor-pointer flex items-center space-x-1"
            >
              <span>+ ส่งประกาศใหม่</span>
            </button>
          </div>
        )}

        {/* Notification List */}
        <div className="p-3 overflow-y-auto divide-y divide-gray-100 flex-1">
          {filteredNotifications.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Bell className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">ไม่มีการแจ้งเตือนในหมวดนี้</p>
              <p className="text-xs text-gray-400 mt-1">การแจ้งเตือนจริงและความปลอดภัยจะแสดงที่นี่</p>
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
                    ? 'hover:bg-gray-50 bg-white opacity-90' 
                    : 'bg-red-50/70 hover:bg-red-50 border border-red-100 shadow-xs'
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
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center border border-red-100 text-red-600">
                      {getIcon(item)}
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-xs">
                    {getIcon(item)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {item.title}
                      </p>
                      {getSeverityBadge(item)}
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                      {formatRelativeOrRealTime(item.createdAtMs, item.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed whitespace-pre-wrap">
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
            <span>ความปลอดภัย & การแจ้งเตือนเรียลไทม์</span>
          </div>

          <div className="flex space-x-2">
            {notifications.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 text-gray-500 hover:text-red-600 font-medium hover:bg-gray-200 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ล้างทั้งหมด</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors cursor-pointer"
            >
              ปิด
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
