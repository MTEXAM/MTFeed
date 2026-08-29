import React, { useState } from 'react';
import { X, Circle, ShieldCheck, Sparkles, MessageSquare, Trash2, UserX, AlertTriangle, Check, Lock, RotateCcw } from 'lucide-react';
import { SessionUser } from '../types';
import { getBadgeStyle, formatUserBadge } from '../utils/auth';

export function OnlineMembersModal({
  isOpen,
  onClose,
  currentUser,
  registeredUsers = [],
  onDeleteUser,
  onClearAllUsers,
  onVerifyAdmin,
  onSelectUserForPost
}: {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SessionUser | null;
  registeredUsers?: SessionUser[];
  onDeleteUser?: (uidOrUsername: string) => void;
  onClearAllUsers?: () => void;
  onVerifyAdmin?: (password: string) => boolean;
  onSelectUserForPost?: (username: string) => void;
}) {
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<SessionUser | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [deleteSuccessMsg, setDeleteSuccessMsg] = useState<string | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const [isUnlockedAdmin, setIsUnlockedAdmin] = useState(false);

  if (!isOpen) return null;

  const isAdmin = Boolean(currentUser?.isAdmin || isUnlockedAdmin);

  // Combine current user + registered accounts from registry (de-duplicated by username or uid)
  const usersMap = new Map<string, SessionUser>();

  if (currentUser) {
    usersMap.set(currentUser.username.toLowerCase(), currentUser);
  }

  registeredUsers.forEach(u => {
    const key = (u.username || u.uid).toLowerCase();
    if (!usersMap.has(key)) {
      usersMap.set(key, u);
    }
  });

  const displayList = Array.from(usersMap.values());

  const handleDelete = (userToDelete: SessionUser) => {
    if (!isAdmin) {
      alert('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถลบบัญชีสมาชิกได้');
      return;
    }
    if (onDeleteUser) {
      onDeleteUser(userToDelete.uid || userToDelete.username);
      setConfirmDeleteUser(null);
      setDeleteSuccessMsg(`ลบบัญชี @${userToDelete.username} สำเร็จ`);
      setTimeout(() => setDeleteSuccessMsg(null), 3000);
    }
  };

  const handleClearAll = () => {
    if (!isAdmin) {
      alert('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถล้างรายชื่อสมาชิกได้');
      setShowClearAllConfirm(false);
      return;
    }
    if (onClearAllUsers) {
      onClearAllUsers();
      setShowClearAllConfirm(false);
      setDeleteSuccessMsg('ล้างรายชื่อสมาชิกในระบบเรียบร้อยแล้ว (ยกเว้นบัญชีแอดมิน)');
      setTimeout(() => setDeleteSuccessMsg(null), 4000);
    }
  };

  const handleUnlockAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword.trim() === 'Bank2546') {
      setIsUnlockedAdmin(true);
      setAdminError(false);
      setAdminPassword('');
      if (onVerifyAdmin) {
        onVerifyAdmin('Bank2546');
      }
    } else {
      setAdminError(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 via-rose-600 to-orange-500 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight flex items-center space-x-2">
                <span>สมาชิกในระบบ MTFeed</span>
                <span className="bg-white/25 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {displayList.length} บัญชี
                </span>
              </h3>
              <p className="text-xs text-red-100 mt-0.5">
                {isAdmin 
                  ? '👑 แอดมินสามารถจัดการ ลบบัญชีผู้ใช้ หรือล้างระบบได้ที่นี่' 
                  : 'รายชื่อเพื่อนๆ สมาชิกที่เข้าใช้งานจริงในระบบ'}
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

        {/* Delete / Clear Success Alert */}
        {deleteSuccessMsg && (
          <div className="bg-emerald-50 text-emerald-800 text-xs px-4 py-2.5 flex items-center justify-between border-b border-emerald-100 animate-in fade-in">
            <div className="flex items-center space-x-1.5 font-semibold">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{deleteSuccessMsg}</span>
            </div>
          </div>
        )}

        {/* Admin Unlock Bar if not admin */}
        {!isAdmin && (
          <form onSubmit={handleUnlockAdmin} className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-1.5 text-xs text-amber-900 font-medium">
              <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
              <span>ปลดล็อคสิทธิ์แอดมิน:</span>
            </div>
            <div className="flex items-center space-x-1.5 flex-1 max-w-[220px]">
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => {
                  setAdminPassword(e.target.value);
                  if (adminError) setAdminError(false);
                }}
                placeholder="รหัสผ่าน Admin..."
                className={`w-full px-2.5 py-1 text-xs border rounded-lg outline-none bg-white ${
                  adminError ? 'border-red-500 ring-1 ring-red-300' : 'border-amber-300 focus:border-amber-500'
                }`}
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
              >
                ปลดล็อค
              </button>
            </div>
          </form>
        )}

        {/* Admin Top Actions Bar if Admin */}
        {isAdmin && (
          <div className="px-4 py-2 bg-red-50/80 border-b border-red-100 flex items-center justify-between text-xs text-red-900 font-semibold">
            <span className="flex items-center space-x-1">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span>โหมดแอดมิน: สามารถกด 🗑️ ลบบัญชีได้ตามต้องการ</span>
            </span>
            <button
              onClick={() => setShowClearAllConfirm(true)}
              className="px-2.5 py-1 bg-red-100 hover:bg-red-600 hover:text-white text-red-700 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 shadow-2xs"
              title="ลบรายชื่อผู้ใช้ทั้งหมดในระบบและเริ่มบันทึกใหม่"
            >
              <RotateCcw className="w-3 h-3" />
              <span>ล้างบัญชีทั้งหมด</span>
            </button>
          </div>
        )}

        {/* Confirm Delete Single User Overlay */}
        {confirmDeleteUser && (
          <div className="p-4 bg-red-50 border-b border-red-200 animate-in fade-in">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900">
                  ยืนยันการลบบัญชี @{confirmDeleteUser.username}?
                </p>
                <p className="text-xs text-red-700 mt-1">
                  ชื่อ: {confirmDeleteUser.name || confirmDeleteUser.username} • UID: #{confirmDeleteUser.uid}
                </p>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => handleDelete(confirmDeleteUser)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    ยืนยันลบผู้ใช้งาน
                  </button>
                  <button
                    onClick={() => setConfirmDeleteUser(null)}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirm Clear All Overlay (Admin Only) */}
        {showClearAllConfirm && isAdmin && (
          <div className="p-4 bg-red-100 border-b border-red-300 animate-in fade-in">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-200 text-red-700 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-bold text-red-950">
                    👑 ยืนยันล้างรายชื่อสมาชิกทั้งหมด?
                  </p>
                  <span className="text-[10px] bg-red-600 text-white font-bold px-1.5 py-0.5 rounded">เฉพาะ Admin</span>
                </div>
                <p className="text-xs text-red-800 mt-1">
                  ระบบจะลบข้อมูลสมาชิกที่บันทึกไว้ทั้งหมดออกจากระบบ เพื่อเริ่มต้นบันทึกใหม่เฉพาะบัญชีใหม่ที่เข้ามาจริง (บัญชีแอดมินของคุณจะยังคงอยู่)
                </p>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    ยืนยันล้างทั้งหมด
                  </button>
                  <button
                    onClick={() => setShowClearAllConfirm(false)}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Member List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto divide-y divide-gray-100">
          {displayList.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <UserX className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">ยังไม่มีผู้ใช้งานอื่นในระบบ</p>
              <p className="text-xs text-gray-400 mt-1">เมื่อมีเพื่อนเข้าสู่ระบบจากเว็บทำข้อสอบ ระบบจะบันทึกและแสดงรายชื่อที่นี่ทันที</p>
            </div>
          ) : (
            displayList.map((member) => {
              const isSelf = currentUser && (member.username.toLowerCase() === currentUser.username.toLowerCase() || member.uid === currentUser.uid);
              const badgeText = member.badge || formatUserBadge(member);
              const style = getBadgeStyle(badgeText);
              const educationInfo = [member.faculty, member.university].filter(Boolean).join(' • ');

              return (
                <div key={member.uid || member.username} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between group hover:bg-gray-50/80 px-2 rounded-xl transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="relative flex-shrink-0">
                      <img 
                        src={member.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(member.username)}&backgroundColor=cccccc`} 
                        alt={member.name || member.username}
                        className="w-11 h-11 rounded-full object-cover border-2 border-white shadow-xs" 
                      />
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {member.name || member.username}
                        </p>
                        {isSelf && (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-md">
                            คุณ
                          </span>
                        )}
                        {badgeText && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                            {badgeText}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 mt-0.5 flex-wrap gap-y-0.5 text-xs text-gray-500">
                        <span className="truncate">@{member.username}</span>
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded border border-gray-200">
                          UID: #{member.uid}
                        </span>
                        {educationInfo && (
                          <span className="text-gray-400 text-[11px] truncate max-w-[200px]" title={educationInfo}>
                            • {educationInfo}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1.5 ml-2 flex-shrink-0">
                    {/* Mention Button */}
                    {onSelectUserForPost && !isSelf && (
                      <button
                        onClick={() => {
                          onSelectUserForPost(`@${member.username} `);
                          onClose();
                        }}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs font-semibold transition-all flex items-center space-x-1"
                        title="กล่าวถึงผู้ใช้นี้ (@mention) ในโพสต์"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">แท็ก @</span>
                      </button>
                    )}

                    {/* Admin Delete User Button */}
                    {isAdmin && (
                      <button
                        onClick={() => setConfirmDeleteUser(member)}
                        className="p-1.5 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs transition-colors flex items-center space-x-1"
                        title="ลบบัญชีผู้ใช้นี้ออกจากระบบ"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[11px] font-bold hidden sm:inline">ลบ</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></span>
            <span>สถานะออนไลน์อิงจากผู้ใช้จริงในระบบ</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-colors"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );
}
