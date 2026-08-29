import React, { useState } from 'react';
import { User, Lock, ArrowRight, ShieldCheck, X } from 'lucide-react';

interface AdminPasswordModalProps {
  username: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AdminPasswordModal({ username, onSuccess, onCancel }: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    setTimeout(() => {
      if (password.trim() === 'Bank2546') {
        sessionStorage.setItem(`mt_admin_verified_${username}`, 'true');
        onSuccess();
      } else {
        setError(true);
        setIsLoading(false);
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-red-50 rounded-xl text-red-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">เข้าสู่ระบบ (Login)</h2>
              <p className="text-xs text-gray-500">ยืนยันตัวตนผู้ดูแลระบบสำหรับ @{username}</p>
            </div>
          </div>
          <button 
            onClick={onCancel} 
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
            title="ยกเลิก"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              ชื่อบัญชีผู้ใช้ (Username) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <User className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text" 
                value={username}
                disabled
                className="block w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl bg-gray-100 text-gray-600 text-sm outline-none cursor-not-allowed font-medium" 
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">ชื่อผู้ใช้ถูกกำหนดอัตโนมัติตามลิงก์ที่เชื่อมต่อเข้ามา</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Password (รหัสผ่าน) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(false);
                }}
                className={`block w-full pl-10 pr-3.5 py-2.5 border rounded-xl text-sm outline-none transition-all ${
                  error 
                    ? 'border-red-500 ring-2 ring-red-200 bg-red-50/30' 
                    : 'border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                }`}
                placeholder="กรอกรหัสผ่าน Admin..." 
                autoFocus
                required
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 font-medium mt-1.5">
                ❌ รหัสผ่านไม่ถูกต้อง! กรุณากรอกรหัสผ่าน Admin ให้ถูกต้อง
              </p>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isLoading || !password}
            className="w-full flex items-center justify-center space-x-2 py-3 px-4 border border-transparent rounded-xl shadow-xs text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 mt-6 transition-colors disabled:opacity-50"
          >
            <span>{isLoading ? 'กำลังตรวจสอบ...' : 'เข้าสู่ระบบ'}</span>
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <div className="flex items-start space-x-2 text-xs text-gray-600">
            <span className="text-base">🔒</span>
            <p className="leading-relaxed">
              สิทธิ์ผู้ดูแลระบบ (Admin) จำเป็นต้องใส่รหัสผ่านยืนยันตัวตน หากไม่กรอกหรือยกเลิก ระบบจะปฏิเสธการเข้าสู่ระบบโดยเด็ดขาด
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

