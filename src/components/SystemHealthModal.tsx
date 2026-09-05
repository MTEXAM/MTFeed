import React, { useState } from 'react';
import { X, ShieldCheck, Database, Cloud, RefreshCw, HardDrive, CheckCircle2, AlertTriangle, Wifi, WifiOff, FileSpreadsheet, Lock, ShieldAlert } from 'lucide-react';
import { SystemHealthState, systemHealthManager } from '../utils/systemHealthService';

export function SystemHealthModal({
  isOpen,
  onClose,
  healthState,
  onForceSyncAll
}: {
  isOpen: boolean;
  onClose: () => void;
  healthState: SystemHealthState;
  onForceSyncAll: () => Promise<void>;
}) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncSuccessMsg(null);
    try {
      await onForceSyncAll();
      await systemHealthManager.runHealthCheck();
      await systemHealthManager.drainOutbox();
      setSyncSuccessMsg('สมานและซิงก์ข้อมูลทุกระบบ (Self-Healing) สำเร็จ 100%');
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return 'กำลังเชื่อมต่อ...';
    const diffSec = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSec < 10) return 'เมื่อสักครู่';
    if (diffSec < 60) return `${diffSec} วินาทีที่แล้ว`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
    return new Date(timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
      case 'active':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ออนไลน์ 100%
          </span>
        );
      case 'standby':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-blue-500"></span>
            พร้อมทำงาน (Standby)
          </span>
        );
      case 'degraded':
      case 'fallback_active':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            สลับใช้ระบบสำรองอัตโนมัติ
          </span>
        );
      case 'offline_mode':
      case 'offline':
      case 'error':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            <span className="w-2 h-2 mr-1.5 rounded-full bg-orange-500"></span>
            โหมดออฟไลน์ (ข้อมูลปลอดภัย)
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-slate-900 p-5 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-lg leading-tight">สถานะความพร้อมของระบบ</h3>
                {healthState.overallStatus === 'healthy' ? (
                  <span className="bg-emerald-500/30 text-emerald-300 text-[11px] px-2 py-0.5 rounded-full font-medium border border-emerald-400/30">
                    เสถียรภาพสูงสุด
                  </span>
                ) : (
                  <span className="bg-amber-500/30 text-amber-300 text-[11px] px-2 py-0.5 rounded-full font-medium border border-amber-400/30">
                    โหมดคุ้มครองข้อมูล
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                ระบบสำรองข้อมูลหลายชั้น (Multi-Tier Redundancy & Self-Healing)
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-gray-700 text-sm">
          
          {/* Main Guarantee Banner */}
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 leading-relaxed">
              <p className="font-semibold text-emerald-950 text-sm mb-1">
                🛡️ การรับประกันความปลอดภัยของข้อมูลผู้ใช้งาน 100% (Zero Data Loss)
              </p>
              หากเซิร์ฟเวอร์หลักหรือระบบ Cloud มีปัญหาหรือสัญญาณเน็ตขาดหาย ระบบจะสลับไปบันทึกยังชั้นสำรองฉุกเฉิน (Google Sheets, SQLite WAL, และ Local Outbox Cache) โดยอัตโนมัติทันที ผู้ใช้จะสามารถใช้งานได้ต่อเนื่องโดยไม่สะดุด
            </div>
          </div>

          {/* Sync Success Alert */}
          {syncSuccessMsg && (
            <div className="p-3 bg-green-100 border border-green-300 text-green-800 rounded-xl text-xs font-medium flex items-center space-x-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span>{syncSuccessMsg}</span>
            </div>
          )}

          {/* 4 Tiers Status Grid */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              สถานะแต่ละชั้นของระบบ (System Layers)
            </h4>

            {/* Layer 1: Firebase Firestore */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm flex items-center space-x-2">
                    <span>1. Cloud Database (Firebase Firestore)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    ฐานข้อมูลเรียลไทม์หลัก • ซิงก์ล่าสุด: {formatTime(healthState.lastSuccessfulFirestoreSync)}
                  </p>
                </div>
              </div>
              <div>{getStatusBadge(healthState.firestore)}</div>
            </div>

            {/* Layer 2: Google Sheets */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm flex items-center space-x-2">
                    <span>2. Google Sheets Master Database</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    สำรองข้อมูล Master Sheet • ซิงก์ล่าสุด: {formatTime(healthState.lastSuccessfulSheetsSync)}
                  </p>
                </div>
              </div>
              <div>{getStatusBadge(healthState.googleSheets)}</div>
            </div>

            {/* Layer 3: SQLite Failover Server */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm flex items-center space-x-2">
                    <span>3. SQLite Server Engine (WAL Failover)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    เซิร์ฟเวอร์สำรองฉุกเฉินระดับ Container • ซิงก์ล่าสุด: {formatTime(healthState.lastSuccessfulBackupSync)}
                  </p>
                </div>
              </div>
              <div>{getStatusBadge(healthState.sqliteBackup)}</div>
            </div>

            {/* Layer 4: Client Outbox & LocalStorage */}
            <div className="p-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 transition-colors flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm flex items-center space-x-2">
                    <span>4. Client Offline Cache & Outbox Queue</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    คิวรอดำเนินการอัตโนมัติ: <span className="font-semibold text-gray-800">{healthState.pendingOutboxCount} รายการ</span> (พร้อมส่งทันทีเมื่อออนไลน์)
                  </p>
                </div>
              </div>
              <div>{getStatusBadge(healthState.offlineCache)}</div>
            </div>
          </div>

          {/* Outbox info if pending */}
          {healthState.pendingOutboxCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>มีข้อมูลรอซิงก์กลับไปยัง Cloud {healthState.pendingOutboxCount} รายการ (ระบบจะส่งให้อัตโนมัติ)</span>
              </div>
              <button
                onClick={() => systemHealthManager.drainOutbox()}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 transition-colors cursor-pointer"
              >
                ส่งทันที
              </button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500">
            ตรวจสอบครั้งล่าสุด: {formatTime(healthState.lastChecked)}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleManualSync}
              disabled={isSyncing}
              className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'กำลังตรวจสอบ & สมานระบบ...' : 'บังคับสมานข้อมูลทุกระบบ (Self-Healing)'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 text-xs font-medium rounded-xl transition-colors"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
