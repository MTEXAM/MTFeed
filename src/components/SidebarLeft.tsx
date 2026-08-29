import React from 'react';
import { MOCK_CATEGORIES } from '../data';
import * as Icons from 'lucide-react';

export function SidebarLeft({ 
  activeCategory, 
  setActiveCategory,
  unreadCount = 0,
  onOpenNotifications
}: { 
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  unreadCount?: number;
  onOpenNotifications?: () => void;
}) {
  return (
    <div className="hidden md:block w-64 flex-shrink-0 py-6 pr-6">
      <div className="sticky top-24">
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

        <div className="mt-8 px-3">
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
