import React, { useState, useRef } from 'react';
import { X, Camera, Trash2, Check, RefreshCw, Sparkles, Shield, User, School, Building2, Upload, AlertTriangle, ShieldAlert } from 'lucide-react';
import { SessionUser } from '../types';
import { USER_GROUPS, ACADEMIC_YEARS, maskUid, formatUserBadge, getBadgeStyle } from '../utils/auth';

export function EditProfileModal({
  isOpen,
  onClose,
  currentUser,
  onSaveProfile
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SessionUser | null;
  onSaveProfile: (updated: Partial<SessionUser>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(currentUser?.name || currentUser?.username || '');
  const [avatar, setAvatar] = useState(currentUser?.avatar || '');

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state if currentUser changes
  React.useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || currentUser.username || '');
      setAvatar(currentUser.avatar || '');
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const defaultAvatar = currentUser.isAdmin 
    ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5'
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(currentUser.username)}&backgroundColor=cccccc`;

  const currentDisplayAvatar = avatar || defaultAvatar;

  // Handle local image upload with auto-resize to keep payload compact
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

  // Generate random Dicebear avatar preset
  const handleRandomAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 9);
    const colors = ['fca5a5', 'bbf7d0', 'fed7aa', 'e9d5ff', 'bae6fd', 'fef08a'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${randomSeed}&backgroundColor=${randomColor}`;
    setAvatar(newAvatarUrl);
  };

  const handleRemoveAvatar = () => {
    setAvatar('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onSaveProfile({
      name: name.trim() || currentUser.username,
      avatar: avatar.trim() || defaultAvatar,
      userGroup: '',
      academicYear: '',
      faculty: '',
      university: '',
      badge: ''
    });

    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-150 my-8">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/70">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">แก้ไขโปรไฟล์</h2>
              <p className="text-xs text-gray-500">ปรับแต่งรูปภาพและข้อมูลส่วนตัวของคุณ</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5 p-4 bg-gray-50/80 rounded-2xl border border-gray-200/70">
            <div className="relative group">
              <img 
                src={currentDisplayAvatar} 
                alt="Profile Preview"
                className="w-20 h-20 rounded-full object-cover border-2 border-white shadow-md bg-white"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="เปลี่ยนรูปโปรไฟล์"
              >
                <Camera className="w-6 h-6" />
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*"
                onChange={handleImageFileChange}
                className="hidden"
              />
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div>
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <p className="text-sm font-bold text-gray-900">รูปภาพโปรไฟล์</p>
                  <span className="text-[11px] text-gray-500 bg-white px-2 py-0.5 rounded-full border border-gray-200">
                    ไม่บังคับใส่
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  อัปโหลดรูปภาพส่วนตัว หรือสุ่มรูปการ์ตูนอวตารได้ตามต้องการ
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="inline-flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                  {isProcessingImage ? 'กำลังโหลด...' : 'อัปโหลดรูป'}
                </button>

                <button
                  type="button"
                  onClick={handleRandomAvatar}
                  className="inline-flex items-center px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                  สุ่มอวตาร
                </button>

                {avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="inline-flex items-center px-2.5 py-1.5 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    title="ลบรูปเพื่อใช้รูปเริ่มต้น"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    ใช้รูปเริ่มต้น
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* User Details Form */}
          <div className="space-y-4">
            
            {/* Display Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                ชื่อที่แสดง (Display Name)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm outline-none transition-all" 
                  placeholder="เช่น พี่หมอแล็บ, จิรภรณ์ ตรวจเลือด..."
                  maxLength={40}
                />
              </div>
            </div>

            {/* Username & UID (Fixed security badges) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  ชื่อผู้ใช้ (Username)
                </label>
                <input 
                  type="text" 
                  disabled
                  value={`@${currentUser.username}`}
                  className="block w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl text-xs font-mono text-gray-600 cursor-not-allowed"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    รหัสประจำตัว (UID)
                  </label>
                  <span className="text-[10px] text-amber-700 font-medium flex items-center">
                    <ShieldAlert className="w-3 h-3 mr-0.5" />
                    ห้ามเปิดเผย
                  </span>
                </div>
                <div className="px-3 py-2 bg-amber-50/50 border border-amber-200/80 rounded-xl text-xs font-mono text-gray-800 flex items-center">
                  <span className="truncate font-semibold">
                    #{maskUid(currentUser.uid, currentUser)}
                  </span>
                </div>
              </div>
            </div>

            {/* UID Security Warning Banner */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-relaxed">
                <p className="font-bold text-amber-950 flex items-center">
                  ⚠️ คำเตือนความปลอดภัย
                </p>
                <p className="mt-0.5 text-xs text-amber-900 font-normal">
                  รหัสประจำตัว (UID) เป็นข้อมูลส่วนบุคคลเพื่อยืนยันสิทธิ์ระหว่าง MTExam และ MTFeed โปรดเก็บเป็นความลับ ห้ามเปิดเผยหรือส่งต่อให้ผู้อื่นเด็ดขาด
                </p>
              </div>
            </div>





          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saveSuccess}
              className="flex-1 flex items-center justify-center py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm transition-colors cursor-pointer"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 mr-1.5 text-white" />
                  บันทึกสำเร็จ!
                </>
              ) : (
                'บันทึกข้อมูล'
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
