import React, { useState } from 'react';
import { X, Lock, KeyRound, ArrowRight, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { SessionUser } from '../types';
import { DEFAULT_ACTIVE_USERS } from '../utils/auth';

interface EmergencyAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmergencyLoginSuccess: (adminUser: SessionUser) => void;
}

export function EmergencyAdminModal({
  isOpen,
  onClose,
  onEmergencyLoginSuccess
}: EmergencyAdminModalProps) {
  const [passcode, setPasscode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  // Recognized secret passcodes for MED68001 emergency verification
  const validPasscodes = ['Bank2546', 'MED68001'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    setTimeout(() => {
      const cleanPass = passcode.trim();
      const isValid = validPasscodes.includes(cleanPass) || cleanPass.toLowerCase() === 'bank2546' || cleanPass.toUpperCase() === 'MED68001';

      if (isValid) {
        setIsSuccess(true);
        // Direct login to the only authorized admin account MED68001
        const adminBase = DEFAULT_ACTIVE_USERS['MED68001'];
        const emergencyAdminUser: SessionUser = {
          ...adminBase,
          uid: 'MED68001',
          username: 'bank',
          name: adminBase?.name || 'Bank',
          isAdmin: true,
          userGroup: '👑 Admin',
          badge: '👑 Admin',
          isEmergencyAdmin: true,
          updatedAt: Date.now()
        };

        try {
          sessionStorage.setItem('mt_admin_verified_MED68001', 'true');
          sessionStorage.setItem('mt_admin_verified_bank', 'true');
          sessionStorage.setItem('mt_emergency_admin_session', 'true');
          localStorage.setItem('mt_emergency_admin_session', 'true');
        } catch (e) {
          console.error(e);
        }

        setTimeout(() => {
          onEmergencyLoginSuccess(emergencyAdminUser);
          setIsLoading(false);
          setIsSuccess(false);
          setPasscode('');
          onClose();
        }, 500);
      } else {
        setIsLoading(false);
        setErrorMsg('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      }
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-200">
        
        {/* Clean, secure header without revealing admin identifiers */}
        <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-800 p-5 text-white flex justify-between items-center relative">
          <div className="flex items-center space-x-3 z-10">
            <div className="p-2 bg-white/10 rounded-xl border border-white/10 text-rose-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base tracking-tight text-white">ระบบปลดล็อกฉุกเฉิน</h3>
              <p className="text-xs text-gray-400 mt-0.5">Emergency Access Authentication</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10 cursor-pointer"
            title="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form asking ONLY for passcode */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
              รหัสผ่านความปลอดภัย (Security Passcode) *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="password"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                className={`block w-full pl-10 pr-3.5 py-3 border rounded-xl text-sm outline-none transition-all ${
                  errorMsg 
                    ? 'border-red-500 ring-2 ring-red-100 bg-red-50/30' 
                    : 'border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500'
                }`}
                placeholder="กรอกรหัสผ่านฉุกเฉิน..."
                required
                autoFocus
              />
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center space-x-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {isSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-bold flex items-center space-x-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>ยืนยันรหัสผ่านสำเร็จ กำลังเข้าสู่ระบบ...</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || isSuccess || !passcode}
            className="w-full flex justify-center items-center py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all cursor-pointer disabled:opacity-50 mt-4"
          >
            {isLoading ? (
              <span>กำลังตรวจสอบรหัสผ่าน...</span>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 mr-2 text-white" />
                <span>ยืนยันรหัสผ่าน</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-center text-[11px] text-gray-400">
          <span>🔒 ระบบรักษาความปลอดภัยแบบเข้ารหัสสิทธิ์เฉพาะกิจ</span>
        </div>
      </div>
    </div>
  );
}
