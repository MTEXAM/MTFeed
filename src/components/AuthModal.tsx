import React, { useState } from 'react';
import { X, Lock, User, ShieldCheck } from 'lucide-react';

export function AuthModal({ 
  isOpen, 
  onClose, 
  onLogin 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onLogin: (username: string, isAdmin: boolean) => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'bank' && password === 'Bank2546') {
      onLogin(username, true);
    } else {
      onLogin(username || 'user1', false);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-bold text-gray-900">เข้าสู่ระบบ MTFeed</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              ชื่อผู้ใช้ (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm outline-none transition-all" 
                placeholder="กรอกชื่อผู้ใช้งาน..." 
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              รหัสผ่าน (Password)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm outline-none transition-all" 
                placeholder="••••••••" 
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-xs text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 mt-6 transition-colors"
          >
            เข้าสู่ระบบ
          </button>
        </form>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-start space-x-2 text-xs text-gray-600">
            <span className="text-base">💡</span>
            <p className="leading-relaxed">
              หากเข้ามาจากเว็บทำข้อสอบ <b>MTExam</b> ระบบจะทำการเชื่อมต่อและจดจำบัญชีรหัส 8 หลัก (UID) ของคุณให้อัตโนมัติโดยไม่ต้องสมัครสมาชิกใหม่
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
