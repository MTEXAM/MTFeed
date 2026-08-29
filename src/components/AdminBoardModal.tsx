import React, { useState } from 'react';
import { X, ShieldAlert, Trash2, Users, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import { Post, SessionUser } from '../types';

export function AdminBoardModal({ 
  isOpen, 
  onClose,
  posts,
  onDeletePost,
  registeredUsers = [],
  onDeleteUser,
  currentUser
}: { 
  isOpen: boolean; 
  onClose: () => void;
  posts: Post[];
  onDeletePost: (postId: string) => void;
  registeredUsers?: SessionUser[];
  onDeleteUser?: (uidOrUsername: string) => void;
  currentUser?: SessionUser | null;
}) {
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<SessionUser | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const reportedPosts = posts.filter(p => p.isReported);

  const handleDeleteUser = (user: SessionUser) => {
    if (onDeleteUser) {
      onDeleteUser(user.uid || user.username);
      setConfirmDeleteUser(null);
      setActionSuccessMsg(`ลบผู้ใช้ @${user.username} ออกจากระบบเรียบร้อยแล้ว`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-100">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gradient-to-r from-red-600 to-rose-600 text-white">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-white/20 rounded-xl">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">ศูนย์ควบคุมผู้ดูแลระบบ (Admin Board)</h2>
              <p className="text-xs text-red-100">จัดการโพสต์ที่ไม่เหมาะสมและจัดการสมาชิกในระบบ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'reports'
                ? 'border-red-600 text-red-600 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>โพสต์ที่ถูกรายงาน ({reportedPosts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center space-x-2 transition-all ${
              activeTab === 'users'
                ? 'border-red-600 text-red-600 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>จัดการสมาชิก ({registeredUsers.length})</span>
          </button>
        </div>

        {/* Action message */}
        {actionSuccessMsg && (
          <div className="bg-emerald-50 text-emerald-800 text-xs px-4 py-2 flex items-center space-x-1.5 border-b border-emerald-100 font-medium">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Confirm Delete User Box */}
        {confirmDeleteUser && (
          <div className="p-4 bg-red-50 border-b border-red-200 animate-in fade-in">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900">
                  ยืนยันการลบและแบนบัญชี @{confirmDeleteUser.username}?
                </p>
                <p className="text-xs text-red-700 mt-1">
                  รหัส UID: #{confirmDeleteUser.uid} • การดำเนินการนี้จะลบบัญชีผู้ใช้นี้ออกจากระบบ
                </p>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={() => handleDeleteUser(confirmDeleteUser)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
                  >
                    ยืนยันลบผู้ใช้
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
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50">
          {activeTab === 'reports' ? (
            <div>
              {reportedPosts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 shadow-xs">
                  <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                  <p className="text-gray-700 font-semibold">ไม่มีโพสต์ที่ถูกรายงานในขณะนี้</p>
                  <p className="text-xs text-gray-400 mt-1">ชุมชนปลอดภัยและเรียบร้อยดี</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reportedPosts.map(post => (
                    <div key={post.id} className="bg-white p-4 rounded-xl border border-red-200 shadow-xs">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          <img src={post.author.avatar} alt="" className="w-8 h-8 rounded-full bg-gray-100 object-cover" />
                          <div>
                            <p className="text-sm font-bold text-gray-900">{post.author.name}</p>
                            <p className="text-xs text-gray-500">@{post.author.username} • {post.createdAt}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            onDeletePost(post.id);
                            setActionSuccessMsg('ลบโพสต์ที่ถูกรายงานเรียบร้อยแล้ว');
                            setTimeout(() => setActionSuccessMsg(null), 3000);
                          }}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-bold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs"
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> ลบโพสต์นี้
                        </button>
                      </div>
                      <div className="text-sm text-gray-800 mt-3 p-3 bg-red-50/50 border border-red-100 rounded-lg whitespace-pre-wrap">
                        {post.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Manage Users Tab */
            <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase">รายชื่อสมาชิกที่ลงทะเบียน</span>
                <span className="text-xs text-gray-500">{registeredUsers.length} บัญชี</span>
              </div>
              
              {registeredUsers.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  ยังไม่มีสมาชิกที่ลงทะเบียนในระบบ
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {registeredUsers.map(user => {
                    const isSelf = currentUser && (user.username === currentUser.username || user.uid === currentUser.uid);
                    return (
                      <div key={user.uid || user.username} className="p-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <img 
                            src={user.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=cccccc`} 
                            alt="" 
                            className="w-10 h-10 rounded-full bg-gray-100 object-cover border border-gray-200" 
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-bold text-gray-900">{user.name || user.username}</p>
                              {user.isAdmin && (
                                <span className="text-[10px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">👑 Admin</span>
                              )}
                              {isSelf && (
                                <span className="text-[10px] bg-gray-100 text-gray-700 font-bold px-1.5 py-0.5 rounded">คุณ</span>
                              )}
                            </div>
                            <div className="flex items-center space-x-2 text-xs text-gray-500 mt-0.5">
                              <span>@{user.username}</span>
                              <span>•</span>
                              <span className="font-mono bg-gray-100 px-1.5 py-0.2 rounded border text-[11px] font-semibold text-gray-700">
                                UID: #{user.uid}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setConfirmDeleteUser(user)}
                          className="inline-flex items-center px-3 py-1.5 bg-red-100 hover:bg-red-600 text-red-600 hover:text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          ลบบัญชีผู้ใช้
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-lg transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>

      </div>
    </div>
  );
}
