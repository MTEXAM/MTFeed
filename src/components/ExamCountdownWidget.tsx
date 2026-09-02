import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Settings, 
  CheckCircle2, 
  X, 
  Save, 
  RotateCcw, 
  Calendar, 
  AlertCircle, 
  RefreshCw, 
  Clock, 
  AlertTriangle,
  Flame,
  Hourglass
} from 'lucide-react';
import { SessionUser, ExamCountdownConfig } from '../types';
import { saveExamCountdownConfig, subscribeToExamCountdownConfig } from '../utils/firestoreService';
import { 
  syncExamToGoogleCalendar, 
  deleteExamFromGoogleCalendar, 
  requestGoogleCalendarAuth, 
  getStoredAccessToken,
  checkGoogleCalendarEventStatus,
  searchExamEventsInGoogleCalendar
} from '../utils/googleCalendarService';

interface ExamCountdownWidgetProps {
  currentUser?: SessionUser | null;
}

export type CountdownPhase = 'NOT_SET' | 'BEFORE_EXAM' | 'IN_PROGRESS' | 'FINISHED';

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

export function formatThaiExamDateRange(startIso: string, endIso?: string | null): string {
  try {
    const start = new Date(startIso);
    if (isNaN(start.getTime())) return 'ยังไม่ได้กำหนด';
    
    const day = start.getDate();
    const thaiMonths = [
      'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
      'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
    ];
    const month = thaiMonths[start.getMonth()];
    const yearBE = start.getFullYear() + 543;
    const startH = String(start.getHours()).padStart(2, '0');
    const startM = String(start.getMinutes()).padStart(2, '0');
    
    if (endIso) {
      const end = new Date(endIso);
      if (!isNaN(end.getTime())) {
        const endH = String(end.getHours()).padStart(2, '0');
        const endM = String(end.getMinutes()).padStart(2, '0');
        
        if (start.toDateString() === end.toDateString()) {
          return `${day} ${month} ${yearBE} เวลา ${startH}:${startM} - ${endH}:${endM} น.`;
        } else {
          const endDay = end.getDate();
          const endMonth = thaiMonths[end.getMonth()];
          const endYearBE = end.getFullYear() + 543;
          return `${day} ${month} ${yearBE} (${startH}:${startM}) - ${endDay} ${endMonth} ${endYearBE} (${endH}:${endM})`;
        }
      }
    }
    
    return `${day} ${month} ${yearBE} เวลา ${startH}:${startM} น.`;
  } catch {
    return 'ยังไม่ได้กำหนด';
  }
}

export function ExamCountdownWidget({ currentUser }: ExamCountdownWidgetProps) {
  // Config state: Default is NULL (No preset date/time - Admin sets it)
  const [config, setConfig] = useState<ExamCountdownConfig>(() => {
    try {
      const saved = localStorage.getItem('mt_feed_exam_countdown_config');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      title: 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
      organizer: 'เพจเล่าเรื่องจากห้องแล็บ',
      targetDateTime: null,
      endDateTime: null,
      calendarEventId: null,
      calendarHtmlLink: null,
      note: ''
    };
  });

  // Countdown timer state
  const [countdownState, setCountdownState] = useState<{
    phase: CountdownPhase;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  }>({
    phase: 'NOT_SET',
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Admin settings modal state
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminDate, setAdminDate] = useState('');
  const [adminTime, setAdminTime] = useState('08:30');
  const [adminEndTime, setAdminEndTime] = useState('12:00');
  const [adminTitle, setAdminTitle] = useState(config.title || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์');
  const [adminOrganizer, setAdminOrganizer] = useState(config.organizer || 'เพจเล่าเรื่องจากห้องแล็บ');
  const [syncToGCal, setSyncToGCal] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingGCal, setIsCheckingGCal] = useState(false);
  const [savingStatusText, setSavingStatusText] = useState('กำลังบันทึก...');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [adminSuccessMsg, setAdminSuccessMsg] = useState<string | null>(null);
  const [adminErrorMsg, setAdminErrorMsg] = useState<string | null>(null);
  const [lastCheckedTime, setLastCheckedTime] = useState<Date | null>(null);

  // Keep ref to latest config to avoid stale closures in timers and event listeners
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Last check timestamp to throttle window focus checks (min 2 mins interval for focus events)
  const lastCheckTimestampRef = useRef<number>(0);

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

  // Check and Sync with Google Calendar: If event exists -> display, if deleted -> reset to default
  const checkAndSyncWithGoogleCalendar = async (forceAuth = false, showToast = true) => {
    setIsCheckingGCal(true);
    setAdminErrorMsg(null);
    lastCheckTimestampRef.current = Date.now();
    setLastCheckedTime(new Date());

    try {
      let token = getStoredAccessToken();
      if (!token && forceAuth) {
        token = await requestGoogleCalendarAuth().catch(() => null);
      }
      if (!token) {
        setIsCheckingGCal(false);
        if (forceAuth && showToast) {
          setAdminErrorMsg('กรุณาอนุญาตการเข้าถึง Google Calendar เพื่อตรวจสอบ');
        }
        return;
      }

      const currentConfig = configRef.current;

      // If we have an existing calendarEventId, check its status directly
      if (currentConfig.calendarEventId) {
        const status = await checkGoogleCalendarEventStatus(token, currentConfig.calendarEventId);
        
        if (status.isDeleted || !status.exists) {
          // Event was deleted from Google Calendar!
          // Reset to default on the website as requested
          console.log('[GCAL SYNC] Event was deleted in Google Calendar. Resetting countdown to default.');
          const resetConfig: ExamCountdownConfig = {
            title: 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
            organizer: 'เพจเล่าเรื่องจากห้องแล็บ',
            targetDateTime: null,
            endDateTime: null,
            calendarEventId: null,
            calendarHtmlLink: null,
            updatedBy: 'Google Calendar Sync (Deleted from Calendar)',
            updatedAt: Date.now()
          };
          setConfig(resetConfig);
          await saveExamCountdownConfig(resetConfig);
          if (showToast) {
            setAdminSuccessMsg('ตรวจพบว่า Event ใน Google Calendar ถูกลบแล้ว — ระบบได้คืนค่าเริ่มต้นเรียบร้อย');
          }
          setIsCheckingGCal(false);
          return;
        }

        if (status.exists && status.eventData) {
          // Event exists! Check if start/end times or title changed
          const { startIso, endIso, summary, htmlLink } = status.eventData;
          if (
            startIso !== currentConfig.targetDateTime || 
            (endIso && endIso !== currentConfig.endDateTime) ||
            htmlLink !== currentConfig.calendarHtmlLink
          ) {
            const updatedConfig: ExamCountdownConfig = {
              ...currentConfig,
              targetDateTime: startIso,
              endDateTime: endIso || currentConfig.endDateTime,
              calendarHtmlLink: htmlLink || currentConfig.calendarHtmlLink,
              title: summary.replace(/^🔬\s*/, '') || currentConfig.title,
              updatedBy: 'Google Calendar Sync',
              updatedAt: Date.now()
            };
            setConfig(updatedConfig);
            await saveExamCountdownConfig(updatedConfig);
            if (showToast) {
              setAdminSuccessMsg('อัปเดตวันเวลาสอบตรงตาม Google Calendar เรียบร้อยแล้ว!');
            }
          } else if (showToast) {
            setAdminSuccessMsg('ข้อมูลวันเวลาตรงกับ Google Calendar เรียบร้อย');
          }
          setIsCheckingGCal(false);
          return;
        }
      }

      // If no calendarEventId is saved yet, search Google Calendar for an active exam event
      const searchResult = await searchExamEventsInGoogleCalendar(token);
      if (searchResult.found && searchResult.eventData) {
        const found = searchResult.eventData;
        const syncedConfig: ExamCountdownConfig = {
          title: found.summary.replace(/^🔬\s*/, '') || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
          organizer: currentConfig.organizer || 'เพจเล่าเรื่องจากห้องแล็บ',
          targetDateTime: found.startIso,
          endDateTime: found.endIso || null,
          calendarEventId: found.id,
          calendarHtmlLink: found.htmlLink || null,
          updatedBy: 'Google Calendar Sync',
          updatedAt: Date.now()
        };
        setConfig(syncedConfig);
        await saveExamCountdownConfig(syncedConfig);
        if (showToast) {
          setAdminSuccessMsg('พบกำหนดการสอบใน Google Calendar และซิงค์ขึ้นเว็บเรียบร้อย!');
        }
      } else {
        // No exam event found in Google Calendar
        if (currentConfig.targetDateTime && currentConfig.calendarEventId) {
          const resetConfig: ExamCountdownConfig = {
            title: 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
            organizer: 'เพจเล่าเรื่องจากห้องแล็บ',
            targetDateTime: null,
            endDateTime: null,
            calendarEventId: null,
            calendarHtmlLink: null,
            updatedBy: 'Google Calendar Sync (Not Found)',
            updatedAt: Date.now()
          };
          setConfig(resetConfig);
          await saveExamCountdownConfig(resetConfig);
          if (showToast) {
            setAdminSuccessMsg('ไม่พบกำหนดการใน Google Calendar — ระบบได้คืนค่าเริ่มต้น');
          }
        } else if (showToast) {
          setAdminSuccessMsg('ตรวจสอบแล้ว ไม่พบ Event การสอบที่ค้างอยู่ใน Google Calendar');
        }
      }
    } catch (err: any) {
      console.warn('[GCAL CHECK ERROR]', err);
    } finally {
      setIsCheckingGCal(false);
    }
  };

  // 1. Auto-check on initial mount (when someone opens the page)
  // 2. Auto-check every 15 minutes (900,000 ms)
  // 3. Auto-check on user focus/visibility change (with 2 min cooldown)
  useEffect(() => {
    // Initial check on mount
    const initialToken = getStoredAccessToken();
    if (initialToken) {
      checkAndSyncWithGoogleCalendar(false, false);
    }

    // Interval every 15 minutes (15 * 60 * 1000 ms)
    const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
    const intervalId = setInterval(() => {
      const token = getStoredAccessToken();
      if (token) {
        console.log('[GCAL AUTO-CHECK] Running 15-minute periodic status check...');
        checkAndSyncWithGoogleCalendar(false, false);
      }
    }, FIFTEEN_MINUTES_MS);

    // Check when user opens / switches back to the tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        // Cooldown of 2 minutes to prevent rapid firing on quick tab switches
        if (now - lastCheckTimestampRef.current >= 2 * 60 * 1000) {
          const token = getStoredAccessToken();
          if (token) {
            console.log('[GCAL AUTO-CHECK] User active/focus detected, checking status...');
            checkAndSyncWithGoogleCalendar(false, false);
          }
        }
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  // Real-time calculation loop (Before Exam -> During Exam Countdown -> Finished)
  useEffect(() => {
    const calculateTime = () => {
      if (!config.targetDateTime) {
        setCountdownState({
          phase: 'NOT_SET',
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0
        });
        return;
      }

      const startTime = new Date(config.targetDateTime).getTime();
      if (isNaN(startTime)) {
        setCountdownState({
          phase: 'NOT_SET',
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0
        });
        return;
      }

      // Default end time is startTime + 3.5 hours if not set
      const endTime = config.endDateTime && !isNaN(new Date(config.endDateTime).getTime())
        ? new Date(config.endDateTime).getTime()
        : startTime + (3.5 * 60 * 60 * 1000);

      const now = Date.now();

      if (now < startTime) {
        // Phase 1: Counting down before the exam starts
        const diff = startTime - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdownState({
          phase: 'BEFORE_EXAM',
          days,
          hours,
          minutes,
          seconds
        });
      } else if (now >= startTime && now < endTime) {
        // Phase 2: Exam is currently IN PROGRESS! Counting down remaining exam time
        const diff = endTime - now;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        setCountdownState({
          phase: 'IN_PROGRESS',
          days,
          hours,
          minutes,
          seconds
        });
      } else {
        // Phase 3: Exam has completed
        setCountdownState({
          phase: 'FINISHED',
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0
        });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [config.targetDateTime, config.endDateTime]);

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

      if (config.endDateTime) {
        const endD = new Date(config.endDateTime);
        if (!isNaN(endD.getTime())) {
          const endHours = String(endD.getHours()).padStart(2, '0');
          const endMinutes = String(endD.getMinutes()).padStart(2, '0');
          setAdminEndTime(`${endHours}:${endMinutes}`);
        }
      } else {
        setAdminEndTime('12:00');
      }
    } else {
      setAdminDate('');
      setAdminTime('08:30');
      setAdminEndTime('12:00');
    }
    setAdminTitle(config.title || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์');
    setAdminOrganizer(config.organizer || 'เพจเล่าเรื่องจากห้องแล็บ');
    setAdminSuccessMsg(null);
    setAdminErrorMsg(null);
    setShowResetConfirm(false);
    setShowAdminModal(true);
  };

  // Helper to add duration to start time
  const applyDurationPreset = (hoursToAdd: number, minutesToAdd = 0) => {
    const [h, m] = (adminTime || '08:30').split(':').map(Number);
    const date = new Date();
    date.setHours(h || 8, m || 30, 0, 0);
    date.setMinutes(date.getMinutes() + (hoursToAdd * 60) + minutesToAdd);
    const nextH = String(date.getHours()).padStart(2, '0');
    const nextM = String(date.getMinutes()).padStart(2, '0');
    setAdminEndTime(`${nextH}:${nextM}`);
  };

  // Save Admin Settings to Firestore & Sync to Google Calendar
  const handleSaveAdminSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminDate) return;

    setIsSaving(true);
    setSavingStatusText('กำลังเชื่อมต่อ Google Calendar...');
    setAdminSuccessMsg(null);
    setAdminErrorMsg(null);

    const startIso = `${adminDate}T${adminTime || '08:30'}:00+07:00`;
    const endIso = `${adminDate}T${adminEndTime || '12:00'}:00+07:00`;
    let calendarEventId = config.calendarEventId || null;
    let calendarHtmlLink = config.calendarHtmlLink || null;

    // 1. Sync to Google Calendar
    if (syncToGCal) {
      try {
        let token = getStoredAccessToken();
        if (!token) {
          const authPromise = requestGoogleCalendarAuth();
          const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
          token = await Promise.race([authPromise, timeoutPromise]).catch(() => null);
        }

        if (token) {
          setSavingStatusText('กำลังบันทึกลงปฏิทิน...');
          const syncPromise = syncExamToGoogleCalendar(
            token,
            adminTitle.trim() || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
            adminOrganizer.trim() || 'เพจเล่าเรื่องจากห้องแล็บ',
            startIso,
            config.calendarEventId,
            endIso
          );
          const syncTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
          const calResult = await Promise.race([syncPromise, syncTimeout]).catch(() => null);

          if (calResult?.eventId) {
            calendarEventId = calResult.eventId;
            calendarHtmlLink = calResult.htmlLink || null;
          }
        }
      } catch (calErr: any) {
        console.warn('[GCAL SYNC WARNING] Direct API sync notice:', calErr);
      }
    }

    setSavingStatusText('กำลังบันทึกข้อมูล...');

    const newConfig: ExamCountdownConfig = {
      title: adminTitle.trim() || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
      organizer: adminOrganizer.trim() || 'เพจเล่าเรื่องจากห้องแล็บ',
      targetDateTime: startIso,
      endDateTime: endIso,
      calendarEventId: calendarEventId,
      calendarHtmlLink: calendarHtmlLink,
      updatedBy: currentUser?.name || currentUser?.username || 'Admin Bank',
      updatedAt: Date.now()
    };

    // Optimistically update local view immediately
    setConfig(newConfig);

    try {
      await saveExamCountdownConfig(newConfig);
      setAdminSuccessMsg('บันทึกและซิงค์วันเวลาสอบเข้าปฏิทินเรียบร้อยแล้ว!');
      setIsSaving(false);
      setTimeout(() => {
        setShowAdminModal(false);
        setAdminSuccessMsg(null);
      }, 600);
    } catch (err: any) {
      console.error(err);
      setIsSaving(false);
      setShowAdminModal(false);
    }
  };

  // Perform Reset to Default State and Delete Calendar Event
  const executeResetToDefault = async () => {
    setIsSaving(true);
    setSavingStatusText('กำลังยกเลิกและลบออกจากปฏิทิน...');
    setAdminSuccessMsg(null);
    setAdminErrorMsg(null);

    const resetConfig: ExamCountdownConfig = {
      title: 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์',
      organizer: 'เพจเล่าเรื่องจากห้องแล็บ',
      targetDateTime: null, // Reset to null
      endDateTime: null,
      calendarEventId: null,
      calendarHtmlLink: null,
      updatedBy: currentUser?.name || currentUser?.username || 'Admin Bank',
      updatedAt: Date.now()
    };

    // Optimistically reset UI immediately
    setConfig(resetConfig);
    setAdminDate('');

    // Delete from Google Calendar if event exists
    if (config.calendarEventId) {
      try {
        const token = getStoredAccessToken() || await requestGoogleCalendarAuth().catch(() => null);
        if (token) {
          deleteExamFromGoogleCalendar(token, config.calendarEventId).catch(() => null);
        }
      } catch (calErr) {
        console.warn('[GCAL DELETE WARNING] Could not delete from Google Calendar API directly:', calErr);
      }
    }

    try {
      await saveExamCountdownConfig(resetConfig);
      setAdminSuccessMsg('ยกเลิกนับถอยหลังและลบออกจากปฏิทินเรียบร้อยแล้ว!');
      setShowResetConfirm(false);
      setIsSaving(false);
      setTimeout(() => {
        setShowAdminModal(false);
        setAdminSuccessMsg(null);
      }, 600);
    } catch (err: any) {
      console.error(err);
      setIsSaving(false);
      setShowAdminModal(false);
    }
  };

  const isAdminUser = Boolean(currentUser?.isAdmin);
  const isExamInProgress = countdownState.phase === 'IN_PROGRESS';
  const isExamFinished = countdownState.phase === 'FINISHED';
  const isCountdownActive = countdownState.phase === 'BEFORE_EXAM';
  const isConfigSet = Boolean(config.targetDateTime);

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

      {/* Main Countdown Box */}
      <div className={`bg-[#0e0e11] border rounded-2xl p-4 sm:p-5 shadow-2xl relative overflow-hidden text-white transition-all duration-500 ${
        isExamInProgress 
          ? 'border-rose-500/60 ring-2 ring-rose-500/20 shadow-rose-950/40' 
          : 'border-amber-500/30'
      }`}>
        
        {/* Subtle decorative glow */}
        <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors ${
          isExamInProgress ? 'bg-rose-500/20' : 'bg-amber-500/10'
        }`} />
        <div className={`absolute -bottom-16 -left-16 w-32 h-32 rounded-full blur-2xl pointer-events-none transition-colors ${
          isExamInProgress ? 'bg-orange-500/20' : 'bg-rose-500/10'
        }`} />

        {/* Header Title & Status Badge */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center justify-center space-x-2 w-full text-center">
            {isExamInProgress ? (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-rose-500/20 border border-rose-500/40 rounded-full animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                <Flame className="w-4 h-4 text-rose-400" />
                <h3 className="text-xs sm:text-sm font-black text-rose-300 tracking-wide">
                  กำลังดำเนินการสอบ! (เหลือเวลาทำข้อสอบอีก)
                </h3>
              </div>
            ) : isExamFinished ? (
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 rounded-full">
                <span className="text-sm">🎉</span>
                <h3 className="text-xs sm:text-sm font-bold text-emerald-300 tracking-wide">
                  การสอบเสร็จสิ้นแล้ว!
                </h3>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-1.5">
                <span className="text-base sm:text-lg">⏱️</span>
                <h3 className="text-xs sm:text-sm font-bold text-amber-400 tracking-wide">
                  {config.title || 'นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์'}
                </h3>
              </div>
            )}
          </div>

          {/* Admin Setting Button */}
          {isAdminUser && (
            <button
              onClick={handleOpenAdminModal}
              className="absolute right-0 top-0 p-1.5 bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 rounded-lg border border-amber-500/30 transition-colors cursor-pointer"
              title="แอดมินตั้งค่าวันเวลาสอบ & ซิงค์ปฏิทิน"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 4 Countdown Boxes: วัน | ชั่วโมง | นาที | วินาที */}
        <div className="grid grid-cols-4 gap-2 sm:gap-2.5 relative z-10">
          {/* Day */}
          <div className={`border rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner transition-colors ${
            isExamInProgress 
              ? 'bg-[#1b1418] border-rose-500/30' 
              : 'bg-[#17171d] border-amber-500/20'
          }`}>
            <span className={`text-xl sm:text-2xl md:text-3xl font-bold font-mono tracking-tight leading-none ${
              isExamInProgress ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {isConfigSet ? countdownState.days : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              วัน
            </span>
          </div>

          {/* Hour */}
          <div className={`border rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner transition-colors ${
            isExamInProgress 
              ? 'bg-[#1b1418] border-rose-500/30' 
              : 'bg-[#17171d] border-amber-500/20'
          }`}>
            <span className={`text-xl sm:text-2xl md:text-3xl font-bold font-mono tracking-tight leading-none ${
              isExamInProgress ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {isConfigSet ? String(countdownState.hours).padStart(2, '0') : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              ชั่วโมง
            </span>
          </div>

          {/* Minute */}
          <div className={`border rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner transition-colors ${
            isExamInProgress 
              ? 'bg-[#1b1418] border-rose-500/30' 
              : 'bg-[#17171d] border-amber-500/20'
          }`}>
            <span className={`text-xl sm:text-2xl md:text-3xl font-bold font-mono tracking-tight leading-none ${
              isExamInProgress ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {isConfigSet ? String(countdownState.minutes).padStart(2, '0') : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              นาที
            </span>
          </div>

          {/* Second */}
          <div className={`border rounded-xl p-2.5 sm:p-3.5 text-center flex flex-col items-center justify-center shadow-inner transition-colors ${
            isExamInProgress 
              ? 'bg-[#1b1418] border-rose-500/30' 
              : 'bg-[#17171d] border-amber-500/20'
          }`}>
            <span className={`text-xl sm:text-2xl md:text-3xl font-bold font-mono tracking-tight leading-none ${
              isExamInProgress ? 'text-rose-400' : 'text-amber-400'
            }`}>
              {isConfigSet ? String(countdownState.seconds).padStart(2, '0') : '--'}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-300 font-medium mt-1.5">
              วินาที
            </span>
          </div>
        </div>

        {/* Footer Text & Phase Indicators */}
        <div className="mt-4 pt-3 border-t border-amber-500/20 text-center relative z-10">
          {isConfigSet ? (
            isExamInProgress ? (
              <div className="space-y-1.5">
                <p className="text-xs text-rose-300 font-semibold flex items-center justify-center gap-1.5">
                  <Hourglass className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  <span>กำลังสอบ: <strong className="text-amber-300">{formatThaiExamDateRange(config.targetDateTime!, config.endDateTime)}</strong></span>
                </p>
                <p className="text-[11px] text-amber-300/90 font-medium">
                  📝 ขอให้ผู้เข้าสอบทุกคนมีสมาธิ ตั้งใจทำข้อสอบอย่างเต็มที่!
                </p>
              </div>
            ) : isExamFinished ? (
              <div className="space-y-1">
                <p className="text-xs text-emerald-400 font-bold">
                  🎉 การสอบเสร็จสิ้นแล้ว! ขอให้ชาว MT ทุกท่านสอบผ่านฉลุย
                </p>
                <p className="text-[11px] text-gray-400">
                  วันเวลาสอบที่ผ่านมา: {formatThaiExamDateRange(config.targetDateTime!, config.endDateTime)}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-gray-300 font-medium">
                  กำหนดการสอบ: <span className="text-amber-300 font-bold">{formatThaiExamDateRange(config.targetDateTime!, config.endDateTime)}</span>
                </p>

                {config.calendarEventId && (
                  <div className="flex items-center justify-center gap-2 pt-0.5">
                    <p className="text-[10px] text-emerald-400/90 font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>เชื่อมต่อกับระบบปฏิทิน Google เรียบร้อย</span>
                    </p>
                    {isAdminUser && (
                      <button
                        type="button"
                        onClick={() => checkAndSyncWithGoogleCalendar(true, true)}
                        disabled={isCheckingGCal}
                        className="text-[10px] text-amber-400/90 hover:text-amber-300 underline flex items-center gap-0.5 cursor-pointer disabled:opacity-50"
                        title="ตรวจสอบการเปลี่ยนแปลงหรือการลบใน Google Calendar"
                      >
                        <RefreshCw className={`w-2.5 h-2.5 ${isCheckingGCal ? 'animate-spin' : ''}`} />
                        <span>เช็คสถานะปฏิทิน</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-gray-400 font-medium">
                วันเวลาสอบ: <span className="text-amber-400/90 font-semibold">ยังไม่ได้กำหนด (รอแอดมินตั้งค่า)</span>
              </p>
              {isAdminUser && (
                <div className="flex items-center justify-center gap-2 pt-0.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => checkAndSyncWithGoogleCalendar(true, true)}
                    disabled={isCheckingGCal}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingGCal ? 'animate-spin' : ''}`} />
                    <span>เช็คจาก Google Calendar</span>
                  </button>
                  <button
                    onClick={handleOpenAdminModal}
                    className="inline-flex items-center px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                  >
                    <Settings className="w-3 h-3 mr-1 text-amber-400" />
                    <span>กำหนดวันเวลาสอบ</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Admin Settings Modal */}
      {showAdminModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 my-auto text-gray-800"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-gray-950 via-slate-900 to-gray-900 px-6 py-4.5 text-white flex justify-between items-center border-b border-gray-800">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-amber-500/20 border border-amber-400/30 rounded-xl text-amber-400 shadow-inner">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white leading-tight">ตั้งค่าวันเวลาสอบ & เวลาสิ้นสุด</h3>
                  <p className="text-xs text-amber-300/80 mt-0.5 font-medium">ระบบนับถอยหลังก่อนสอบ & นับเวลาขณะสอบต่อเนื่อง</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAdminModal(false)}
                className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveAdminSettings} className="p-6 space-y-4 text-sm">
              {/* Event Title */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  หัวข้อการสอบ / ชื่องาน
                </label>
                <input
                  type="text"
                  value={adminTitle}
                  onChange={(e) => setAdminTitle(e.target.value)}
                  placeholder="นับถอยหลังวันเวลาสอบสภาเทคนิคการแพทย์"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
                  required
                />
              </div>

              {/* Organizer Name */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  ชื่อผู้จัดทำ / ผู้เผยแพร่
                </label>
                <input
                  type="text"
                  value={adminOrganizer}
                  onChange={(e) => setAdminOrganizer(e.target.value)}
                  placeholder="เพจเล่าเรื่องจากห้องแล็บ"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center">
                  <Calendar className="w-3.5 h-3.5 mr-1 text-amber-500" />
                  <span>วันที่สอบ *</span>
                </label>
                <input
                  type="date"
                  value={adminDate}
                  onChange={(e) => setAdminDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all cursor-pointer"
                  required
                />
              </div>

              {/* Start & End Time Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    <span>เวลาเริ่มสอบ *</span>
                  </label>
                  <input
                    type="time"
                    value={adminTime}
                    onChange={(e) => setAdminTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1 text-rose-600" />
                      <span>เวลาสิ้นสุดการสอบ *</span>
                    </div>
                  </label>
                  <input
                    type="time"
                    value={adminEndTime}
                    onChange={(e) => setAdminEndTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all cursor-pointer"
                    required
                  />
                </div>
              </div>

              {/* Quick Duration Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] font-bold text-gray-500 mr-1">ปุ่มลัดเวลาสอบ:</span>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(3, 0)}
                  className="px-2 py-1 bg-gray-100 hover:bg-amber-100 hover:text-amber-900 border border-gray-200 hover:border-amber-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  +3 ชม.
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(3, 30)}
                  className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  +3.5 ชม. (มาตรฐาน)
                </button>
                <button
                  type="button"
                  onClick={() => applyDurationPreset(4, 0)}
                  className="px-2 py-1 bg-gray-100 hover:bg-amber-100 hover:text-amber-900 border border-gray-200 hover:border-amber-300 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  +4 ชม.
                </button>
                <button
                  type="button"
                  onClick={() => setAdminEndTime('12:00')}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  12:00 น.
                </button>
                <button
                  type="button"
                  onClick={() => setAdminEndTime('16:30')}
                  className="px-2 py-1 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  16:30 น.
                </button>
              </div>

              {/* Google Calendar Sync & Reconciliation Tools */}
              <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={syncToGCal}
                      onChange={(e) => setSyncToGCal(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                    />
                    <span className="font-bold text-emerald-950 text-xs sm:text-sm">
                      📅 ซิงค์เข้า Google Calendar อัตโนมัติ (บันทึกช่วงเวลาสอบจริง)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => checkAndSyncWithGoogleCalendar(true, true)}
                    disabled={isCheckingGCal || isSaving}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                    title="ตรวจสอบวันเวลาสอบหรือเช็คว่ามีการลบ Event ใน Google Calendar หรือไม่"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingGCal ? 'animate-spin text-emerald-600' : 'text-emerald-700'}`} />
                    <span>{isCheckingGCal ? 'กำลังตรวจสอบ...' : 'ดึง/เช็คจาก Google Calendar'}</span>
                  </button>
                </div>
                <p className="text-xs text-emerald-800/90 leading-relaxed pl-6.5">
                  ระบบจะสร้าง Event ลง Google Calendar ทันที และจะ<strong>ตรวจสอบสถานะอัตโนมัติทุกๆ 15 นาที หรือเมื่อมีผู้เปิดใช้งานหน้าเว็บ</strong> หากมีการลบ Event ออกจาก Google Calendar โดยตรง ระบบจะตรวจพบและคืนค่าเริ่มต้นบนเว็บให้อัตโนมัติ
                </p>
              </div>

              {/* Date Preview Box */}
              {adminDate && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-950 text-xs">
                  <span className="font-bold text-amber-900 block mb-0.5">พรีวิวการแสดงผลวันและช่วงเวลาสอบ:</span>
                  <p className="font-mono text-sm font-bold text-amber-700">
                    {formatThaiExamDateRange(
                      `${adminDate}T${adminTime || '08:30'}:00`,
                      `${adminDate}T${adminEndTime || '12:00'}:00`
                    )}
                  </p>
                </div>
              )}

              {/* In-Modal Confirmation Banner for Reset */}
              {showResetConfirm && (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>ยืนยันการยกเลิกนับถอยหลังและลบจากปฏิทิน?</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    ระบบจะเคลียร์วันเวลาสอบกลับเป็นค่าเริ่มต้น และลบ Event ออกจาก Google Calendar ทันที
                  </p>
                  <div className="flex items-center space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={executeResetToDefault}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer flex items-center space-x-1"
                    >
                      {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      <span>ใช่, ยืนยันยกเลิกและลบ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      disabled={isSaving}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}

              {/* Status Notifications */}
              {adminSuccessMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{adminSuccessMsg}</span>
                </div>
              )}

              {adminErrorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{adminErrorMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  disabled={isSaving}
                  className="w-full sm:w-auto px-3.5 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="ยกเลิกนับถอยหลังและลบออกจากปฏิทิน"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ยกเลิกนับถอยหลัง & ลบจากปฏิทิน</span>
                </button>

                <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAdminModal(false)}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    ปิด
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !adminDate}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-950 font-black rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:shadow-none"
                  >
                    {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{isSaving ? savingStatusText : 'บันทึก & ซิงค์ปฏิทิน'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
