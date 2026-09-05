import React, { useState, useRef } from 'react';
import { X, User, ShieldCheck, Camera, Sparkles, Upload, Trash2, ArrowRight } from 'lucide-react';

export function AuthModal({ 
  isOpen, 
  onClose, 
  onLogin
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onLogin: (username: string, isAdmin: boolean, verifiedAdmin?: boolean, avatar?: string, displayName?: string) => void;
}) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const cleanUser = username.trim() || 'medtech_student';
  const previewAvatar = avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(cleanUser)}&backgroundColor=cccccc`;

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, GIF, WebP)');
      return;
    }

    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setAvatar(compressedDataUrl);
        }
        setIsProcessingImage(false);
      };
      img.onerror = () => {
        setIsProcessingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 9);
    const colors = ['fca5a5', 'bbf7d0', 'fed7aa', 'e9d5ff', 'bae6fd', 'fef08a'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setAvatar(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}&backgroundColor=${randomColor}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalUsername = username.trim() || 'medtech_user';
    onLogin(finalUsername, false, false, avatar || undefined, displayName.trim() || undefined);
    onClose();
  };

  const handleQuickLogin = (demoUsername: string, demoDisplayName: string) => {
    onLogin(demoUsername, false, false, undefined, demoDisplayName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150 my-6">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-red-600 to-rose-600 text-white">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-yellow-300" />
            <h2 className="text-base font-bold">เข้าสู่ระบบ MTFeed</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Optional Profile Picture */}
          <div className="flex items-center space-x-3.5 p-3.5 bg-gray-50 rounded-2xl border border-gray-200/80">
            <div className="relative group flex-shrink-0">
              <img 
                src={previewAvatar} 
                alt="Avatar Preview" 
                className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-xs bg-white"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="เลือกรูปโปรไฟล์"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-gray-800">รูปโปรไฟล์</span>
                <span className="text-[10px] text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                  ไม่บังคับ
                </span>
              </div>
              
              <div className="flex items-center space-x-2 mt-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="inline-flex items-center px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-[11px] font-semibold text-gray-700 shadow-2xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {isProcessingImage ? 'กำลังโหลด...' : 'เลือกรูป'}
                </button>

                <button
                  type="button"
                  onClick={handleRandomAvatar}
                  className="inline-flex items-center px-2 py-1 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg text-[11px] font-semibold text-gray-700 shadow-2xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3 h-3 mr-1 text-amber-500" />
                  สุ่มอวตาร
                </button>

                {avatar && (
                  <button
                    type="button"
                    onClick={() => setAvatar('')}
                    className="p-1 text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="ล้างรูปโปรไฟล์"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              ชื่อผู้ใช้ (Username หรือ รหัสประจำตัว)
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
                placeholder="เช่น jiraporn_med, student68 หรือ bank" 
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              ชื่อที่แสดง (Display Name - ไม่บังคับ)
            </label>
            <input 
              type="text" 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="block w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm outline-none transition-all" 
              placeholder="เว้นว่างไว้จะใช้ชื่อเดียวกับ Username" 
            />
          </div>

          <button 
            type="submit" 
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl shadow-xs text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 mt-6 transition-colors cursor-pointer"
          >
            <span>เข้าสู่ระบบทันที</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
        </form>

        {/* Quick test accounts */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-700 mb-2">หรือเลือกเข้าใช้งานด่วน:</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('jiraporn_med', 'จิรภรณ์ ตรวจเลือด')}
              className="px-2.5 py-2 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-gray-200 rounded-xl text-left text-xs font-medium text-gray-700 transition-colors shadow-2xs cursor-pointer"
            >
              <div className="font-bold truncate">🔬 นศ. จิรภรณ์</div>
              <div className="text-[10px] text-gray-400 truncate">@jiraporn_med</div>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('kanokwan_exam', 'กนกวรรณ เตรียมสอบ')}
              className="px-2.5 py-2 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 border border-gray-200 rounded-xl text-left text-xs font-medium text-gray-700 transition-colors shadow-2xs cursor-pointer"
            >
              <div className="font-bold truncate">📝 กนกวรรณ</div>
              <div className="text-[10px] text-gray-400 truncate">@kanokwan_exam</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
