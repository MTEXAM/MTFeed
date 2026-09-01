import React from 'react';
import { ShieldCheck, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type: 'info' | 'warning' | 'success';
  message: string;
  submessage?: string;
}

export function SystemToastContainer({
  toasts,
  onDismiss,
  onOpenSystemHealth
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onOpenSystemHealth?: () => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none px-3">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';
        const isInfo = toast.type === 'info';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl shadow-xl border backdrop-blur-md transition-all duration-300 transform translate-y-0 animate-in slide-in-from-bottom-5 ${
              isSuccess
                ? 'bg-white/95 border-emerald-300 text-gray-900 shadow-emerald-500/10'
                : isWarning
                ? 'bg-white/95 border-amber-300 text-gray-900 shadow-amber-500/10'
                : 'bg-white/95 border-blue-300 text-gray-900 shadow-blue-500/10'
            }`}
          >
            <div className="flex items-start space-x-3">
              <div
                className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                  isSuccess
                    ? 'bg-emerald-100 text-emerald-700'
                    : isWarning
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {isSuccess && <CheckCircle2 className="w-5 h-5" />}
                {isWarning && <AlertTriangle className="w-5 h-5" />}
                {isInfo && <ShieldCheck className="w-5 h-5" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-900 leading-tight">
                  {toast.message}
                </p>
                {toast.submessage && (
                  <p className="text-[11px] text-gray-600 mt-1 leading-normal">
                    {toast.submessage}
                  </p>
                )}
                {onOpenSystemHealth && (
                  <button
                    onClick={() => {
                      onDismiss(toast.id);
                      onOpenSystemHealth();
                    }}
                    className="mt-2 inline-flex items-center text-[11px] font-semibold text-red-600 hover:text-red-700 hover:underline cursor-pointer"
                  >
                    ดูรายละเอียดความพร้อมของระบบ →
                  </button>
                )}
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
