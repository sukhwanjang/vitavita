'use client';
import { useState } from 'react';
import { IconX, IconUpload, IconZap } from './ui/icons';

// 탐색기 "경로로 복사"(Ctrl+Shift+C)로 붙여넣으면 따옴표가 붙어 오므로 제거
const cleanPath = (raw: string) => raw.trim().replace(/^"+|"+$/g, '');

interface FileDropModalProps {
  show: boolean;
  onClose: () => void;
  onAdd: (path: string, creator: string | null, urgent: boolean, note: string | null) => Promise<boolean>;
}

export default function FileDropModal({ show, onClose, onAdd }: FileDropModalProps) {
  const [input, setInput] = useState('');
  const [note, setNote] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  if (!show) return null;

  const handleAdd = async () => {
    const path = cleanPath(input);
    if (!path || isAdding) return;
    setIsAdding(true);
    const creator = localStorage.getItem('vitavita_creator');
    const ok = await onAdd(path, creator, isUrgent, note.trim() || null);
    setIsAdding(false);
    if (ok) {
      setInput('');
      setNote('');
      setIsUrgent(false);
      onClose();
    }
  };

  const handleClose = () => {
    setInput('');
    setNote('');
    setIsUrgent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
      <div className="bg-white rounded-md shadow-xl border border-slate-200 w-full max-w-lg relative animate-fadein">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900">
              <IconUpload className="w-4 h-4 text-blue-600" />
              출력요청
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">작업 끝낸 파일의 위치를 공유합니다. 출력대기에 표시됩니다.</p>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            onClick={handleClose}
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.replace(/^"+|"+$/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="\\NAS\출력\업체명\프로그램\파일.eps"
            autoFocus
            className="w-full rounded border border-slate-300 px-3.5 h-11 text-sm font-mono text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <p className="text-xs text-slate-400 mt-2">
            탐색기에서 파일 선택 → <b className="text-slate-600">Ctrl+Shift+C</b> (경로로 복사) → 여기에 <b className="text-slate-600">Ctrl+V</b>
          </p>

          {/* 요청 메모 + 급함 */}
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="요청 메모 (예: 3장, 유포지) — 선택"
              className="flex-1 rounded border border-slate-300 px-3.5 h-10 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <button
              type="button"
              onClick={() => setIsUrgent(!isUrgent)}
              title="긴급 출력 (목록 맨 위에 빨간색으로 고정)"
              className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded border text-sm font-semibold transition ${
                isUrgent
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-600'
              }`}
            >
              <IconZap className="w-3.5 h-3.5" />
              급함
            </button>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-md">
          <button
            onClick={handleClose}
            className="h-10 px-5 rounded border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            취소
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || !cleanPath(input)}
            className="h-10 px-6 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition disabled:bg-slate-300"
          >
            {isAdding ? '올리는 중...' : '올리기'}
          </button>
        </div>
      </div>
    </div>
  );
}
