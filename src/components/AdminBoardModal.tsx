import React, { useState } from 'react';
import { X, ShieldAlert, Trash2, Users, AlertTriangle, ShieldCheck, Check, Send, Megaphone } from 'lucide-react';
import { Post, SessionUser } from '../types';
import { maskUid } from '../utils/auth';

export function AdminBoardModal({ 
  isOpen, 
  onClose,
  posts,
  onDeletePost,
  registeredUsers = [],
  onDeleteUser,
  onClearAllUsers,
  currentUser,
  onSendBroadcast,
  onOpenSystemHealth
}: { 
  isOpen: boolean; 
  onClose: () => void;
  posts: Post[];
  onDeletePost: (postId: string) => void;
  registeredUsers?: SessionUser[];
  onDeleteUser?: (uidOrUsername: string) => void;
  onClearAllUsers?: () => void;
  currentUser?: SessionUser | null;
  onSendBroadcast?: (broadcast: { 
    title: string; 
    description: string; 
    severity: 'info' | 'warning' | 'alert' | 'success'; 
    senderType: 'admin' | 'system';
  }) => Promise<void>;
  onOpenSystemHealth?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'broadcast'>('reports');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<SessionUser | null>(null);
  const [showClearAllConfirm, setShowClearAllConfirm] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Broadcast Form State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastDesc, setBroadcastDesc] = useState('');
  const [broadcastSeverity, setBroadcastSeverity] = useState<'info' | 'warning' | 'alert' | 'success'>('info');
  const [broadcastSender, setBroadcastSender] = useState<'admin' | 'system'>('admin');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  if (!isOpen) return null;

  const reportedPosts = posts.filter(p => p.isReported);

  const handleDeleteUser = (user: SessionUser) => {
    if (!currentUser?.isAdmin) {
      alert('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดำเนินการนี้ได้');
      return;
    }
    if (onDeleteUser) {
      onDeleteUser(user.uid || user.username);
      setConfirmDeleteUser(null);
      setActionSuccessMsg(`ลบบัญชี @${user.username} ออกจากระบบเรียบร้อยแล้ว`);
      setTimeout(() => setActionSuccessMsg(null), 3000);
    }
  };

  const handleClearAll = () => {
    if (!currentUser?.isAdmin) {
      alert('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถดำเนินการนี้ได้');
      setShowClearAllConfirm(false);
      return;
    }
    if (onClearAllUsers) {
      onClearAllUsers();
      setShowClearAllConfirm(false);
      setActionSuccessMsg('ล้างรายชื่อสมาชิกในระบบเรียบร้อยแล้ว (ยกเว้นแอดมินปัจจุบัน)');
      setTimeout(() => setActionSuccessMsg(null), 4000);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastDesc.trim()) {
      alert('กรุณากรอกหัวข้อและเนื้อหาประกาศให้ครบถ้วน');
      return;
    }

    if (!currentUser?.isAdmin) {
      alert('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่มีสิทธิ์ส่งประกาศ');
      return;
    }

    try {
      setIsBroadcasting(true);
      if (onSendBroadcast) {
        await onSendBroadcast({
          title: broadcastTitle.trim(),
          description: broadcastDesc.trim(),
          severity: broadcastSeverity,
          senderType: broadcastSender
        });
      }
      setActionSuccessMsg('📢 ส่งข้อความแจ้งเตือน "ระบบ & ความปลอดภัย" ไปยังผู้ใช้ทุกคนเรียบร้อยแล้ว!');
      setBroadcastTitle('');
      setBroadcastDesc('');
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการส่งประกาศ: ' + (err.message || err));
    } finally {
      setIsBroadcasting(false);
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
              <p className="text-xs text-red-100">จัดการความปลอดภัย ประกาศเตือน และจัดการสมาชิกในระบบ</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onOpenSystemHealth && (
              <button 
                onClick={onOpenSystemHealth} 
                className="px-2.5 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-white/20"
                title="ดูสถานะความพร้อมของระบบและการสำรองข้อมูลหลายชั้น (Multi-Tier Redundancy & Self-Healing)"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-300" />
                <span className="hidden sm:inline">สถานะระบบ (Multi-Tier)</span>
              </button>
            )}
            <button onClick={onClose} className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/20 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-4 pt-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
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
            className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-red-600 text-red-600 bg-white rounded-t-lg'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>จัดการสมาชิก ({registeredUsers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`px-4 py-2.5 font-bold text-sm border-b-2 flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === 'broadcast'
                ? 'border-red-600 text-red-600 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Megaphone className="w-4 h-4 text-red-500" />
            <span className="text-red-600 font-bold">ส่งประกาศ ระบบ & ความปลอดภัย</span>
          </button>
        </div>

        {/* Action message */}
        {actionSuccessMsg && (
          <div className="bg-emerald-50 text-emerald-800 text-xs px-4 py-2 flex items-center space-x-1.5 border-b border-emerald-100 font-medium animate-in fade-in">
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
                  รหัส UID: #{maskUid(confirmDeleteUser.uid, currentUser)} • การดำเนินการนี้จะลบบัญชีผู้ใช้นี้ออกจากระบบ
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

        {/* Confirm Clear All Overlay */}
        {showClearAllConfirm && (
          <div className="p-4 bg-red-100 border-b border-red-300 animate-in fade-in">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-200 text-red-700 rounded-xl flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-950">
                  ⚠️ ยืนยันการล้างบัญชีสมาชิกทั้งหมดในระบบ?
                </p>
                <p className="text-xs text-red-800 mt-1">
                  การดำเนินการนี้จะลบข้อมูลสมาชิกทั้งหมดในระบบและใน Cloud Firestore (จะคงเหลือเฉพาะบัญชีผู้ดูแลระบบปัจจุบัน)
                </p>
                <div className="mt-3 flex space-x-2">
                  <button
                    onClick={handleClearAll}
                    className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
                  >
                    ล้างบัญชีทั้งหมดทันที
                  </button>
                  <button
                    onClick={() => setShowClearAllConfirm(false)}
                    className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium transition-colors border border-gray-300"
                  >
                    ยกเลิก
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="p-4 overflow-y-auto flex-1 bg-gray-50/50">
          {activeTab === 'broadcast' ? (
            /* Broadcast to System & Security Tab */
            <div className="bg-white rounded-xl border border-red-100 shadow-xs p-5 space-y-4">
              <div className="flex items-center space-x-3 pb-3 border-b border-gray-100">
                <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-100">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">ส่งข้อความแจ้งเตือนในหมวด "ระบบ & ความปลอดภัย"</h3>
                  <p className="text-xs text-gray-500">
                    ข้อความนี้จะถูกส่งแบบเรียลไทม์ไปยังกระดิ่งแจ้งเตือนของผู้ใช้ทุกคน และเข้าหมวด <b>ระบบ & ความปลอดภัย</b> ทันที
                  </p>
                </div>
              </div>

              {/* Quick Template Presets */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  เลือกหัวข้อด่วน (Quick Presets):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { title: '🔒 แจ้งเตือนความปลอดภัย: บัญชีผู้ใช้และรหัส UID', desc: 'ระบบได้เพิ่มการเข้ารหัสข้อมูลบัญชีและเชื่อมต่อกับรหัสประจำตัว UID ป้องกันการแอบอ้างสิทธิ์', sev: 'info', sender: 'admin' },
                    { title: '🛠️ ประกาศปรับปรุงและบำรุงรักษาระบบสำรองข้อมูล', desc: 'ระบบกำลังดำเนินการซิงก์ข้อมูลสำรองระหว่าง Google Sheets, SQLite และ Firestore เพื่อความเสถียรสูงสุด', sev: 'warning', sender: 'admin' },
                    { title: '⚡ แจ้งเตือนระบบสำรองข้อมูลฉุกเฉิน (Zero-Downtime)', desc: 'ระบบทำงานในโหมดสำรองฉุกเฉินอัตโนมัติ ข้อมูลทุกโพสต์ปลอดภัย 100% และยังใช้งานได้ตามปกติ', sev: 'alert', sender: 'system' },
                    { title: '🟢 ระบบกลับสู่สภาวะปกติสมบูรณ์ 100%', desc: 'การเชื่อมต่อระบบฐานข้อมูล Cloud และ Google Sheets ประสานงานตรงกันเรียบร้อยแล้ว', sev: 'success', sender: 'system' }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setBroadcastTitle(preset.title);
                        setBroadcastDesc(preset.desc);
                        setBroadcastSeverity(preset.sev as any);
                        setBroadcastSender(preset.sender as any);
                      }}
                      className="px-2.5 py-1 text-xs bg-gray-50 hover:bg-red-50 hover:text-red-700 hover:border-red-200 text-gray-700 rounded-lg border border-gray-200 transition-colors"
                    >
                      {preset.title.split(':')[0]}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    หัวข้อประกาศ (Title) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={broadcastTitle}
                    onChange={(e) => setBroadcastTitle(e.target.value)}
                    placeholder="เช่น แจ้งเตือนความปลอดภัย หรือ ประกาศปรับปรุงระบบ"
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 font-medium"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    เนื้อหาข้อความแจ้งเตือน (Content) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={broadcastDesc}
                    onChange={(e) => setBroadcastDesc(e.target.value)}
                    placeholder="พิมพ์รายละเอียดประกาศที่จะส่งให้ผู้ใช้ทุกคนทราบ..."
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 leading-relaxed"
                  />
                </div>

                {/* Sender and Severity Grids */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Sender Selection */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      ผู้ส่งข้อความ (Sender Identity)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBroadcastSender('admin')}
                        className={`p-2 rounded-xl text-xs font-bold border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                          broadcastSender === 'admin'
                            ? 'bg-red-50 border-red-300 text-red-800 shadow-xs'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-sm">👑</span>
                        <div>
                          <p className="leading-tight">แอดมิน (Admin)</p>
                          <p className="text-[10px] text-gray-500 font-normal">#MED68001</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBroadcastSender('system')}
                        className={`p-2 rounded-xl text-xs font-bold border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                          broadcastSender === 'system'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-xs'
                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="text-sm">🛡️</span>
                        <div>
                          <p className="leading-tight">ระบบอัตโนมัติ AI</p>
                          <p className="text-[10px] text-gray-500 font-normal">System Sentinel</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Severity Level */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                      ระดับความสำคัญ (Severity)
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { id: 'info', label: '🔵 ทั่วไป (Info)', color: 'border-blue-200 bg-blue-50 text-blue-800' },
                        { id: 'warning', label: '🟡 ปลอดภัย (Warn)', color: 'border-amber-200 bg-amber-50 text-amber-800' },
                        { id: 'alert', label: '🔴 ฉุกเฉิน (Alert)', color: 'border-rose-200 bg-rose-50 text-rose-800' },
                        { id: 'success', label: '🟢 สำเร็จ (Success)', color: 'border-emerald-200 bg-emerald-50 text-emerald-800' }
                      ].map((sev) => (
                        <button
                          key={sev.id}
                          type="button"
                          onClick={() => setBroadcastSeverity(sev.id as any)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-center transition-all cursor-pointer ${
                            broadcastSeverity === sev.id
                              ? `${sev.color} font-bold ring-2 ring-red-500/20`
                              : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {sev.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isBroadcasting || !broadcastTitle || !broadcastDesc}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-xs transition-all cursor-pointer"
                  >
                    {isBroadcasting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>กำลังส่งประกาศไปยังทุกคน...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>ส่งประกาศเข้า "ระบบ & ความปลอดภัย" ของสมาชิกทุกคน</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : activeTab === 'reports' ? (
            /* Reported Posts Tab */
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
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-gray-700 uppercase">รายชื่อสมาชิกที่ลงทะเบียน</span>
                  <span className="text-xs bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-full">
                    {registeredUsers.length} บัญชี
                  </span>
                </div>
                {onClearAllUsers && registeredUsers.length > 0 && (
                  <button
                    onClick={() => setShowClearAllConfirm(true)}
                    className="inline-flex items-center px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                    ล้างบัญชีทั้งหมด
                  </button>
                )}
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
                                UID: #{maskUid(user.uid, currentUser)}
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
