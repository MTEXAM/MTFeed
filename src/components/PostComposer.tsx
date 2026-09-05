import React, { useState, useRef, useEffect } from 'react';
import { BarChart2, Hash, Ghost, Smile, X, AtSign, Link2, Image as ImageIcon, FileText } from 'lucide-react';
import { PollOption, SessionUser } from '../types';
import { maskUid, MAIN_SITE_URL, sanitizeDisplayName, sanitizeUsername } from '../utils/auth';

export function PostComposer({ 
  onPost,
  user,
  externalSharedText,
  onClearExternalSharedText,
  registeredUsers = [],
  onLoginClick
}: { 
  onPost: (
    content: string, 
    isAnonymous: boolean, 
    image?: string, 
    poll?: { options: { id: string, text: string, votes: number }[], expiresAt: string, totalVotes: number },
    pdf?: { data?: string; name?: string; size?: number; url?: string }
  ) => void;
  user?: SessionUser | null;
  externalSharedText?: string | null;
  onClearExternalSharedText?: () => void;
  registeredUsers?: SessionUser[];
  onLoginClick?: () => void;
}) {
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInputUrl, setLinkInputUrl] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [imageFileBase64, setImageFileBase64] = useState<string | null>(null);
  const [pdfFileBase64, setPdfFileBase64] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfFileSize, setPdfFileSize] = useState<number | null>(null);
  
  const mentionMenuRef = useRef<HTMLDivElement>(null);
  const linkMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('กรุณาเลือกไฟล์ PDF เท่านั้นครับ');
        return;
      }
      setPdfFileName(file.name);
      setPdfFileSize(file.size);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPdfFileBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (externalSharedText) {
      setContent(prev => prev ? prev + '\n\n' + externalSharedText : externalSharedText);
      if (onClearExternalSharedText) {
        onClearExternalSharedText();
      }
    }
  }, [externalSharedText, onClearExternalSharedText]);

  // Click outside menus
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mentionMenuRef.current && !mentionMenuRef.current.contains(e.target as Node)) {
        setShowMentionMenu(false);
      }
      if (linkMenuRef.current && !linkMenuRef.current.contains(e.target as Node)) {
        setShowLinkInput(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedContent = (content || '').trim();
    if (!trimmedContent) return;
    
    let pollData;
    if (showPoll && pollOptions.filter(o => typeof o === 'string' && o.trim()).length >= 2) {
      pollData = {
        options: pollOptions.filter(o => typeof o === 'string' && o.trim()).map((opt, i) => ({
          id: `opt_${i}`,
          text: opt.trim(),
          votes: 0
        })),
        expiresAt: 'พรุ่งนี้',
        totalVotes: 0
      };
    }
    
    onPost(
      trimmedContent, 
      isAnonymous, 
      imageFileBase64 || undefined, 
      pollData,
      pdfFileBase64 ? { data: pdfFileBase64, name: pdfFileName || 'เอกสารแนบ.pdf', size: pdfFileSize || 0 } : undefined
    );
    setContent('');
    setIsAnonymous(false);
    setShowPoll(false);
    setShowMentionMenu(false);
    setShowLinkInput(false);
    setPollOptions(['', '']);
    setImageFileBase64(null);
    setPdfFileBase64(null);
    setPdfFileName(null);
    setPdfFileSize(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const handleInsertMention = (username: string) => {
    setContent(prev => `${prev} @${username} `);
    setShowMentionMenu(false);
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInputUrl.trim()) return;
    let formatted = linkInputUrl.trim();
    if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
      formatted = `https://${formatted}`;
    }
    setContent(prev => prev ? `${prev} ${formatted} ` : `${formatted} `);
    setLinkInputUrl('');
    setShowLinkInput(false);
  };

  if (!user) {
    return (
      <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-amber-50/50">
        <div className="text-center py-2 max-w-lg mx-auto">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-700 mb-2 text-base">
            🔒
          </div>
          <h3 className="text-sm font-bold text-gray-800">กรุณาเข้าสู่ระบบผ่านเว็บไซต์หลัก</h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            คุณสามารถเข้าสู่ระบบและร่วมพูดคุยได้โดยผ่านเว็บไซต์ 
            <a href={MAIN_SITE_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mx-1 break-all">
              {MAIN_SITE_URL}
            </a>
            เท่านั้น
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 border-b border-gray-200">
      <div className="flex space-x-3">
        <div className="flex-shrink-0">
          <img
            className="h-10 w-10 rounded-full bg-gray-100 object-cover border border-gray-200 shadow-xs"
            src={(!user || isAnonymous) 
              ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Anon&backgroundColor=cccccc' 
              : (user.avatar || (user.isAdmin 
                  ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Admin&backgroundColor=fca5a5' 
                  : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.username)}&backgroundColor=cccccc`))}
            alt=""
          />
        </div>
        <div className="min-w-0 flex-1">
          <form onSubmit={handleSubmit}>
            <div>
              <label htmlFor="post" className="sr-only">
                มีอะไรอยากเล่า วางลิงก์ หรือถามเพื่อนๆ วันนี้...
              </label>
              <textarea
                id="post"
                name="post"
                rows={3}
                className="block w-full border-0 resize-none focus:ring-0 sm:text-lg text-gray-900 placeholder-gray-500 bg-transparent outline-none"
                placeholder="มีอะไรอยากเล่า วางลิงก์ ถามเพื่อนๆ หรือแท็ก @เพื่อน วันนี้..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>
            
            {showPoll && (
              <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-gray-700">ตัวเลือกโพล</h4>
                  <button type="button" onClick={() => setShowPoll(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {pollOptions.map((opt, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`ตัวเลือกที่ ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const newOpts = [...pollOptions];
                      newOpts[i] = e.target.value;
                      setPollOptions(newOpts);
                    }}
                    className="w-full mb-2 p-2 rounded-lg border border-gray-300 text-sm outline-none focus:border-red-500"
                  />
                ))}
                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="text-xs text-red-600 hover:text-red-700 font-medium mt-1"
                  >
                    + เพิ่มตัวเลือก
                  </button>
                )}
              </div>
            )}
            
            {imageFileBase64 && (
              <div className="relative mt-3 mb-2 inline-block">
                <img src={imageFileBase64} alt="Preview" className="max-h-48 rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={() => {
                    setImageFileBase64(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute -top-2 -right-2 p-1 bg-gray-800 text-white rounded-full hover:bg-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {pdfFileBase64 && (
              <div className="relative mt-3 mb-2 inline-flex items-center gap-3 bg-red-50/80 border border-red-200 rounded-xl p-3 pr-10 shadow-xs max-w-full">
                <div className="w-10 h-10 rounded-lg bg-red-600 text-white flex flex-col items-center justify-center font-bold text-[10px] shadow-xs flex-shrink-0">
                  <FileText className="w-5 h-5" />
                  <span>PDF</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-900 truncate max-w-xs sm:max-w-md">
                    {pdfFileName || 'เอกสารแนบ.pdf'}
                  </p>
                  <p className="text-[10px] text-gray-500 font-medium">
                    {formatBytes(pdfFileSize || 0)} • พร้อมสำรองข้อมูลไปยังคลาวด์
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPdfFileBase64(null);
                    setPdfFileName(null);
                    setPdfFileSize(null);
                    if (pdfInputRef.current) pdfInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors"
                  title="ยกเลิกแนบไฟล์ PDF"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {/* Action buttons and Post button */}
            <div className="mt-4 flex items-center justify-between pt-2 border-t border-gray-100 relative">
              <div className="flex space-x-1 sm:space-x-2 items-center flex-wrap gap-y-1">
                {/* Image Upload */}
                <input 
                  type="file" 
                  accept="image/*" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                  title="แนบรูปภาพ"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>

                {/* PDF Document Upload */}
                <input 
                  type="file" 
                  accept="application/pdf,.pdf" 
                  ref={pdfInputRef} 
                  onChange={handlePdfUpload} 
                  className="hidden" 
                />
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="inline-flex items-center p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                  title="แนบเอกสาร PDF (ชีตสรุป/ข้อสอบ)"
                >
                  <FileText className="h-5 w-5" />
                </button>

                <button 
                  type="button" 
                  onClick={() => setShowPoll(!showPoll)} 
                  className="inline-flex items-center p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors" 
                  title="สร้างโพล"
                >
                  <BarChart2 className="h-5 w-5" />
                </button>

                {/* Insert Link Tool */}
                <div className="relative" ref={linkMenuRef}>
                  <button
                    type="button"
                    onClick={() => setShowLinkInput(!showLinkInput)}
                    className="inline-flex items-center p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                    title="แทรกหรือวางลิงก์ (URL)"
                  >
                    <Link2 className="h-5 w-5" />
                  </button>

                  {showLinkInput && (
                    <div className="absolute left-0 bottom-full mb-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-3">
                      <p className="text-xs font-bold text-gray-700 mb-2">วางลิงก์เว็บไซต์</p>
                      <div className="space-y-2">
                        <input
                          type="url"
                          value={linkInputUrl}
                          onChange={(e) => setLinkInputUrl(e.target.value)}
                          placeholder="https://example.com"
                          className="w-full text-xs p-2 rounded-lg border border-gray-300 outline-none focus:border-red-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleInsertLink(e);
                            }
                          }}
                        />
                        <div className="flex justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowLinkInput(false)}
                            className="px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded-md"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="button"
                            onClick={handleInsertLink}
                            className="px-3 py-1 text-xs font-bold bg-red-600 text-white hover:bg-red-700 rounded-md shadow-xs"
                          >
                            แทรกลิงก์
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mention @ Button with dropdown list */}
                <div className="relative" ref={mentionMenuRef}>
                  <button 
                    type="button" 
                    onClick={() => setShowMentionMenu(!showMentionMenu)}
                    className="inline-flex items-center p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors" 
                    title="แท็กกล่าวถึงเพื่อน (@mention)"
                  >
                    <AtSign className="h-5 w-5" />
                  </button>

                  {showMentionMenu && (() => {
                    const nonAdminUsers = registeredUsers.filter(u => !u.isAdmin && u.badge !== '👑 Admin');
                    return (
                      <div className="absolute left-0 bottom-full mb-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 z-50 p-2 max-h-60 overflow-y-auto">
                        <div className="px-2 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-1 flex items-center justify-between">
                          <span>เลือกเพื่อนที่ต้องการ @</span>
                          <span>{nonAdminUsers.length} คน</span>
                        </div>
                        {nonAdminUsers.length === 0 ? (
                          <div className="p-3 text-center text-xs text-gray-500">
                            พิมพ์ @ แล้วตามด้วยชื่อผู้ใช้ได้เลย
                          </div>
                        ) : (
                          nonAdminUsers.map(u => (
                            <button
                              key={u.uid || u.username}
                              type="button"
                              onClick={() => handleInsertMention(u.username)}
                              className="w-full text-left p-2 hover:bg-red-50 rounded-lg flex items-center space-x-2 transition-colors"
                            >
                              <img 
                                src={u.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}&backgroundColor=cccccc`} 
                                alt="" 
                                className="w-6 h-6 rounded-full object-cover" 
                              />
                              <div className="min-w-0 flex-1 truncate">
                                <p className="text-xs font-bold text-gray-900 truncate">{sanitizeDisplayName(u.name, u.uid, u.isAdmin)}</p>
                                <p className="text-[10px] text-gray-500 truncate">@{sanitizeUsername(u.username, u.uid, u.isAdmin)}</p>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })()}
                </div>

                <button 
                  type="button" 
                  onClick={() => setContent(content + ' #')}
                  className="inline-flex items-center p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors hidden sm:block" 
                  title="ใส่แฮชแท็กวิชา"
                >
                  <Hash className="h-5 w-5" />
                </button>
                <button 
                  type="button" 
                  onClick={() => setContent(content + ' 😊')}
                  className="inline-flex items-center p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors hidden sm:block"
                >
                  <Smile className="h-5 w-5" />
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsAnonymous(!isAnonymous)}
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${isAnonymous ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100 bg-gray-50'}`}
                  title="ส่งแบบไม่ระบุตัวตน"
                >
                  <Ghost className={`h-4 w-4 mr-1 ${isAnonymous ? 'text-white' : 'text-gray-500'}`} />
                  <span className="hidden sm:inline">{isAnonymous ? 'นิรนาม' : 'ปกติ'}</span>
                </button>
              </div>
              <div className="flex-shrink-0">
                <button
                  type="submit"
                  className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-bold rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
                  disabled={content.trim().length === 0}
                >
                  โพสต์
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
