import React, { useState } from 'react';
import { ExternalLink, ShieldAlert, AlertTriangle, Check, Copy, ArrowRight, X } from 'lucide-react';

export function ExternalLinkModal({
  isOpen,
  url,
  onClose,
  onConfirm
}: {
  isOpen: boolean;
  url: string | null;
  onClose: () => void;
  onConfirm?: (url: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !url) return null;

  // Extract hostname for cleaner presentation
  let hostname = url;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    hostname = parsed.hostname;
  } catch (e) {
    hostname = url;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleProceed = () => {
    if (onConfirm) {
      onConfirm(url);
    } else {
      const target = url.startsWith('http') ? url : `https://${url}`;
      window.open(target, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">
                แจ้งเตือนความปลอดภัย
              </h3>
              <p className="text-xs text-orange-100 mt-0.5">
                คุณกำลังจะออกจากเว็บไซต์ MTFeed
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

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-start space-x-3 text-amber-800 bg-amber-50/80 p-3.5 rounded-xl border border-amber-200/80">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-amber-900 mb-1">
                โปรดตรวจสอบความน่าเชื่อถือของเว็บไซต์ปลายทาง
              </p>
              <p className="text-amber-800/90">
                เว็บไซต์ภายนอกไม่ได้ดำเนินการโดย MTFeed โปรดระมัดระวังการกรอกข้อมูลสำคัญ ข้อมูลส่วนบุคคล หรือรหัสผ่านบนเว็บปลายทาง
              </p>
            </div>
          </div>

          {/* Destination URL Preview Box */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              ลิงก์ปลายทางที่กำลังจะเปิด (Destination URL)
            </label>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 font-mono text-xs text-gray-800 break-all">
              <span className="truncate mr-2 font-medium text-red-600">{url}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex-shrink-0 p-1.5 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors flex items-center space-x-1"
                title="คัดลอกลิงก์"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                <span className="text-[11px] font-sans font-medium">{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</span>
              </button>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50/60 p-3 rounded-lg flex items-center justify-between">
            <span>โดเมนเป้าหมาย:</span>
            <span className="font-semibold font-mono text-gray-800">{hostname}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row-reverse gap-2 sm:gap-3">
          <button
            type="button"
            onClick={handleProceed}
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-xs transition-colors"
          >
            <span>ยืนยันและไปยังเว็บไซต์ภายนอก</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-white hover:bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl border border-gray-200 transition-colors"
          >
            ยกเลิก / อยู่ใน MTFeed
          </button>
        </div>

      </div>
    </div>
  );
}
