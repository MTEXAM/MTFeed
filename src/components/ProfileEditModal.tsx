import React, { useState } from 'react';
import { X, Award, GraduationCap, Building2, School, User, Check, Sparkles } from 'lucide-react';
import { SessionUser } from '../types';
import { USER_GROUPS, ACADEMIC_YEARS, formatUserBadge, getBadgeStyle, saveRegisteredUser } from '../utils/auth';

export function ProfileEditModal({
  isOpen,
  onClose,
  user,
  onUpdateUser
}: {
  isOpen: boolean;
  onClose: () => void;
  user: SessionUser | null;
  onUpdateUser: (updatedUser: SessionUser) => void;
}) {
  if (!isOpen || !user) return null;

  const [name, setName] = useState(user.name || user.username);
  const [userGroup, setUserGroup] = useState(user.userGroup || '🔬🎓 นศ.เทคนิคการแพทย์');
  const [academicYear, setAcademicYear] = useState(user.academicYear || 'ปี 3');
  const [faculty, setFaculty] = useState(user.faculty || 'คณะเทคนิคการแพทย์');
  const [university, setUniversity] = useState(user.university || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const previewBadge = formatUserBadge({
    isAdmin: user.isAdmin,
    userGroup,
    academicYear
  });

  const badgeStyle = getBadgeStyle(previewBadge);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser: SessionUser = {
      ...user,
      name: name.trim() || user.username,
      userGroup,
      academicYear,
      faculty: faculty.trim(),
      university: university.trim(),
      badge: previewBadge
    };

    saveRegisteredUser(updatedUser);
    onUpdateUser(updatedUser);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Award className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">ข้อมูลสถานะผู้ใช้งานและป้ายยศ</h3>
              <p className="text-xs text-red-100 mt-0.5">
                ปรับแต่งข้อมูลสถานะการศึกษาและป้ายยศที่แสดงบนโพสต์
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

        {savedSuccess && (
          <div className="bg-emerald-50 text-emerald-800 text-xs px-4 py-3 flex items-center space-x-2 border-b border-emerald-100">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">บันทึกข้อมูลสถานะเรียบร้อยแล้ว</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          
          {/* Badge Preview Box */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              ตัวอย่างการแสดงผลบนโพสต์
            </p>
            <div className="flex items-center space-x-3">
              <img 
                src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=cccccc`} 
                alt={user.username}
                className="w-10 h-10 rounded-full bg-gray-200 object-cover border border-gray-300"
              />
              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="text-sm font-bold text-gray-900">{name || user.username}</span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${badgeStyle.bg} ${badgeStyle.text} ${badgeStyle.border}`}>
                    {previewBadge}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex items-center space-x-1.5 mt-0.5">
                  <span>@{user.username}</span>
                  <span>•</span>
                  <span className="font-mono text-[11px] text-gray-600">UID: #{user.uid}</span>
                  {(faculty || university) && (
                    <>
                      <span>•</span>
                      <span className="text-gray-600 truncate max-w-[150px]">
                        {[faculty, university].filter(Boolean).join(' ')}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
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
                className="block w-full pl-10 pr-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="ระบุชื่อที่ต้องการแสดง..."
              />
            </div>
          </div>

          {/* User Group */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              สถานะ / กลุ่มผู้ใช้งาน *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {USER_GROUPS.map((group) => (
                <button
                  type="button"
                  key={group}
                  onClick={() => setUserGroup(group)}
                  className={`p-2.5 text-left rounded-xl text-xs font-semibold border transition-all flex items-center justify-between ${
                    userGroup === group
                      ? 'bg-red-50 border-red-500 text-red-700 shadow-xs ring-1 ring-red-500'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{group}</span>
                  {userGroup === group && <Check className="w-4 h-4 text-red-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Academic Year */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              ระบุชั้นปีที่กำลังศึกษา
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {ACADEMIC_YEARS.map((yr) => (
                <button
                  type="button"
                  key={yr}
                  onClick={() => setAcademicYear(yr)}
                  className={`p-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                    academicYear === yr
                      ? 'bg-red-50 border-red-500 text-red-700 shadow-xs ring-1 ring-red-500'
                      : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          {/* Faculty */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              คณะที่กำลังศึกษาอยู่
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <GraduationCap className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text"
                value={faculty}
                onChange={(e) => setFaculty(e.target.value)}
                className="block w-full pl-10 pr-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="เช่น คณะเทคนิคการแพทย์, คณะสหเวชศาสตร์"
              />
            </div>
          </div>

          {/* University */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
              ชื่อมหาวิทยาลัย (เว้นว่างได้)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <School className="h-4 w-4 text-gray-400" />
              </div>
              <input 
                type="text"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                className="block w-full pl-10 pr-3.5 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                placeholder="เช่น มหาวิทยาลัยเชียงใหม่, จุฬาลงกรณ์มหาวิทยาลัย"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3 flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>บันทึกสถานะ</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
