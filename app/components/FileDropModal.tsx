'use client';
import { useState } from 'react';

// 탐색기 "경로로 복사"(Ctrl+Shift+C)로 붙여넣으면 따옴표가 붙어 오므로 제거
const cleanPath = (raw: string) => raw.trim().replace(/^"+|"+$/g, '');

interface FileDropModalProps {
  show: boolean;
  onClose: () => void;
  onAdd: (path: string, creator: string | null) => Promise<boolean>;
}

export default function FileDropModal({ show, onClose, onAdd }: FileDropModalProps) {
  const [input, setInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  if (!show) return null;

  const handleAdd = async () => {
    const path = cleanPath(input);
    if (!path || isAdding) return;
    setIsAdding(true);
    const creator = localStorage.getItem('vitavita_creator');
    const ok = await onAdd(path, creator);
    setIsAdding(false);
    if (ok) {
      setInput('');
      onClose();
    }
  };

  const handleClose = () => {
    setInput('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-lg relative animate-fadein">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl font-bold transition"
          onClick={handleClose}
          aria-label="닫기"
        >
          ×
        </button>

        <h3 className="text-xl font-bold text-gray-900 mb-1">📁 파일 올리기</h3>
        <p className="text-sm text-gray-500 mb-6">작업 끝낸 파일의 위치를 공유합니다. 왼쪽 파일 대기함에 표시돼요.</p>

        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.replace(/^"+|"+$/g, ''))}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="\\NAS\출력\업체명\프로그램\파일.eps"
          autoFocus
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-blue-400 transition"
        />
        <p className="text-xs text-gray-400 mt-2">
          탐색기에서 파일 선택 → <b>Ctrl+Shift+C</b> (경로로 복사) → 여기에 <b>Ctrl+V</b>
        </p>

        <div className="flex justify-end gap-3 pt-6 mt-6 border-t">
          <button
            onClick={handleClose}
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl font-semibold shadow hover:bg-gray-200 transition"
          >
            취소
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || !cleanPath(input)}
            className="bg-gradient-to-r from-blue-500 to-blue-700 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold px-8 py-2 rounded-xl shadow-lg hover:scale-105 disabled:hover:scale-100 transition"
          >
            {isAdding ? '올리는 중...' : '올리기'}
          </button>
        </div>
      </div>
    </div>
  );
}
