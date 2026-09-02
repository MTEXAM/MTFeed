import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  CheckCircle2, 
  X, 
  Save,
  RotateCcw
} from 'lucide-react';
import { SessionUser, ExamCountdownConfig } from '../types';
import { saveExamCountdownConfig, subscribeToExamCountdownConfig } from '../utils/firestoreService';

interface ExamCountdownWidgetProps {
  currentUser?: SessionUser | null;
}

export function formatThaiExamDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'ยังไม่ได้กำหนด';
    
    const day = d.getDate();
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const month = thaiMonths[d.getMonth()];
    const yearBE = d.getFullYear() + 543;
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${day} ${month} ${yearBE} เวลา ${hours}:${minutes} น.`;
  } catch {
    return 'ยังไม่ได้กำหนด';
  }
}

export function ExamCountdownWidget({ currentUser }: ExamCountdownWidgetProps) {
  // Config state: Default is NULL (No preset date/time - Admin must set it)
  const [config, setConfig] = useState<ExamCountdownConfig>(() => {
    try {
      const saved = localStorage.getItem('mt_feed_exam_countdown_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
      organizer: 'เพจเล่าเรื่องจากห้องแล็บ',
      targetDateTime: null, // ค่าเริ่มต้นคือไม่มีวันเวลา แอดมินเป็นคนตั้งเอง
      note: ''
    };
  });

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
    isSet: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isPast: false,
    isSet: false
  });

  // Admin settings modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminDate, setAdminDate] = useState('');
  const [adminTime, setAdminTime] = useState('08:30');
  const [adminTitle, setAdminTitle] = useState(config.title || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์');
  const [adminOrganizer, setAdminOrganizer] = useState(config.organizer || 'เพจเล่าเรื่องจากห้องแล็บ');
  const [isSaving, setIsSaving] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);

  // Subscribe to real-time changes in Firestore
  useEffect(() => {
    const unsubscribe = subscribeToExamCountdownConfig((newConfig) => {
      if (newConfig) {
        setConfig(newConfig);
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // Real-time calculation loop
  useEffect(() => {
    const calculateTime = () => {
      if (!config.targetDateTime) {
        setTimeLeft({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isPast: false,
          isSet: false
        });
        return;
      }

      const targetTime = new Date(config.targetDateTime).getTime();
      const now = new Date().getTime();
      const diff = targetTime - now;

      if (isNaN(targetTime)) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false, isSet: false });
        return;
      }

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true, isSet: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isPast: false, isSet: true });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [config.targetDateTime]);

  // Open Admin Edit Modal
  const handleOpenAdminModal = () => {
    if (config.targetDateTime) {
      const d = new Date(config.targetDateTime);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        setAdminDate(`${year}-${month}-${day}`);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        setAdminTime(`${hours}:${minutes}`);
      }
    } else {
      setAdminDate('');
      setAdminTime('08:30');
    }
    setAdminTitle(config.title || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์');
    setAdminOrganizer(config.organizer || 'เพจเล่าเรื่องจากห้องแล็บ');
    setAdminSuccessMsg(null);
    setShowAdminModal(true);
  };

  // Save Admin Settings to Firestore
  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminDate) return;

    setIsSaving(true);
    const combinedIso = `${adminDate}T${adminTime || '00:00'}:00+07:00`;

    const newConfig: ExamCountdownConfig = {
      title: adminTitle.trim() || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
      organizer: adminOrganizer.trim() || 'เพจเล่าเรื่องจากห้องแล็บ',
      targetDateTime: combinedIso,
      updatedBy: currentUser?.name || currentUser?.username || 'Admin Bank',
      updatedAt: Date.now()
    };

    try {
      await saveExamCountdownConfig(newConfig);
      setConfig(newConfig);
      setAdminSuccessMsg('บันทึกและเผยแพร่เวลาสอบเรียบร้อยแล้ว!');
      setTimeout(() => {
        setIsSaving(false);
        setShowAdminModal(false);
        setAdminSuccessMsg(null);
      }, 700);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  // Clear / Reset to No Date (Default State)
  const handleResetToDefault = async () => {
    if (!window.confirm('คุณต้องการรีเซ็ตวันสอบกลับเป็นค่าเริ่มต้น (ยังไม่มีการกำหนดวันสอบ) ใช่หรือไม่?')) return;
    setIsSaving(true);
    const resetConfig: ExamCountdownConfig = {
      title: 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
      organizer: 'เพจเล่าเรื่องจากห้องแล็บ',
      targetDateTime: null, // Reset to null
      updatedBy: currentUser?.name || currentUser?.username || 'Admin Bank',
      updatedAt: Date.now()
    };

    try {
      await saveExamCountdownConfig(resetConfig);
      setConfig(resetConfig);
      setAdminSuccessMsg('รีเซ็ตกลับเป็นค่าเริ่มต้นเรียบร้อยแล้ว');
      setTimeout(() => {
        setIsSaving(false);
        setShowAdminModal(false);
        setAdminSuccessMsg(null);
      }, 700);
    } catch (err) {
      console.error(err);
      setIsSaving(false);
    }
  };

  const isAdminUser = Boolean(currentUser?.isAdmin);

  return (
    <div className="w-full space-y-3">
      {/* Brand Header: จัดทำโดย เพจเล่าเรื่องจากห้องแล็บ */}
      <div className="text-center pt-1 pb-0.5">
        <div className="text-amber-400 font-bold text-xs tracking-wider uppercase drop-shadow-xs">
          {config.organizer ? 'จัดทำโดย' : ''}
        </div>
        <h2 className="text-lg sm:text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-amber-300 to-yellow-400">
          {config.organizer || 'เพจเล่าเรื่องจากห้องแล็บ'}
        </h2>
      </div>

      {/* Main Countdown Box (Dark Card with Gold Accents matching the Official Website) */}
      <div className="bg-[#0e0e11] border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden text-white">
        
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-rose-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header Title with Timer Icon */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center justify-center space-x-2 w-full text-center">
            <span className="text-base sm:text-lg">⏱️</span>
            <h3 className="text-xs sm:text-sm font-bold text-amber-400 tracking-wide">
              {config.title || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์'}
            </h3>
          </div>

          {/* Admin Setting Button */}
          {isAdminUser && (
            <button
              onClick={handleOpenAdminModal}
              className="absolute right-0 top-0 p-1.5 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
              title="แอดมินตั้งค่าวันเวลาสอบ"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 4 Countdown Boxes: วัน | ชั่วโมง | นาที | วินาที */}
        <div className="grid grid-cols-4 gap-2 sm:gap-2.5 relative z-10">
          {/* Day */}
          <div className="bg-[#17171d] border border-amber-500/20 rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-amber-400 tracking-tight leading-none">
              {timeLeft.isSet ? timeLeft.days : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              วัน
            </span>
          </div>

          {/* Hour */}
          <div className="bg-[#17171d] border border-amber-500/20 rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-amber-400 tracking-tight leading-none">
              {timeLeft.isSet ? String(timeLeft.hours).padStart(2, '0') : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              ชั่วโมง
            </span>
          </div>

          {/* Minute */}
          <div className="bg-[#17171d] border border-amber-500/20 rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-amber-400 tracking-tight leading-none">
              {timeLeft.isSet ? String(timeLeft.minutes).padStart(2, '0') : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              นาที
            </span>
          </div>

          {/* Second */}
          <div className="bg-[#17171d] border border-amber-500/20 rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner">
            <span className="text-xl sm:text-2xl md:text-3xl font-bold font-mono text-amber-400 tracking-tight leading-none">
              {timeLeft.isSet ? String(timeLeft.seconds).padStart(2, '0') : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              วินาที
            </span>
          </div>
        </div>

        {/* Footer Text */}
        <div className="mt-4 pt-3 border-t border-amber-500/20 text-center relative z-10">
          {timeLeft.isSet ? (
            timeLeft.isPast ? (
              <p className="text-xs text-emerald-400 font-bold">
                🎉 การสอบเสร็จสิ้นแล้ว! ขอให้ชาว MT ทุกท่านสอบผ่านฉลุย
              </p>
            ) : (
              <p className="text-xs text-gray-300 font-medium">
                วันเวลาสอบ: <span className="text-amber-300 font-bold">{formatThaiExamDateTime(config.targetDateTime!)}</span>
              </p>
            )
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-gray-400 font-medium">
                วันเวลาสอบ: <span className="text-amber-400/90 font-semibold">ยังไม่ได้กำหนด (รอแอดมินตั้งค่า)</span>
              </p>
              {isAdminUser && (
                <button
                  onClick={handleOpenAdminModal}
                  className="mt-1.5 inline-flex items-center px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 mr-1 text-amber-400" />
                  <span>กดตรงนี้เพื่อกำหนดวันเวลาสอบ</span>
                </button>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Admin Settings Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-800 p-5 text-white flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">ตั้งค่าวันเวลาสอบ (เฉพาะแอดมิน)</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Admin Exam Countdown Manager</p>
                </div>
              </div>

              <button
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAdminSettings} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  หัวข้อการสอบ / ชื่องาน
                </label>
                <input
                  type="text"
                  value={adminTitle}
                  onChange={(e) => setAdminTitle(e.target.value)}
                  placeholder="นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  ชื่อผู้จัดทำ / ผู้เผยแพร่
                </label>
                <input
                  type="text"
                  value={adminOrganizer}
                  onChange={(e) => setAdminOrganizer(e.target.value)}
                  placeholder="เพจเล่าเรื่องจากห้องแล็บ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    📅 วันที่สอบ *
                  </label>
                  <input
                    type="date"
                    value={adminDate}
                    onChange={(e) => setAdminDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    ⏰ เวลาสอบ *
                  </label>
                  <input
                    type="time"
                    value={adminTime}
                    onChange={(e) => setAdminTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                    required
                  />
                </div>
              </div>

              {adminDate && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                  <span className="font-bold">พรีวิวการแสดงผล:</span>
                  <p className="mt-1 font-mono font-semibold">
                    {formatThaiExamDateTime(`${adminDate}T${adminTime || '00:00'}:00`)}
                  </p>
                </div>
              )}

              {adminSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{adminSuccessMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  disabled={isSaving}
                  className="px-3 py-2 bg-gray-100 hover:bg-rose-50 text-gray-700 hover:text-rose-700 font-semibold rounded-xl text-xs flex items-center space-x-1 transition-colors cursor-pointer"
                  title="รีเซ็ตกลับเป็นยังไม่มีวันสอบ"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>รีเซ็ตเป็นค่าเริ่มต้น</span>
                </button>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !adminDate}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกและเผยแพร่'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
