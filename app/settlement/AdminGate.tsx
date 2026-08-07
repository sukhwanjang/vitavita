'use client';
import { useState } from 'react';
import { IconLock } from '../components/ui/icons';

// 월말 정산 관리자 비밀번호 (현황판 로그인과 별개로 한 번 더 확인)
// 비밀번호 원문 대신 SHA-256 해시만 저장 — 저장소/소스에서 원문이 보이지 않음
const ADMIN_PW_HASH = '69fda234dbf41b30d958f9c8c750d5d51ffbd4794449de3992acf19d16825cdd';
const KEEP_MS = 1000 * 60 * 60 * 24 * 7; // 일주일 유지

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

interface AdminGateProps {
  onAuthenticated: () => void;
}

export default function AdminGate({ onAuthenticated }: AdminGateProps) {
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((await sha256Hex(pwInput)) === ADMIN_PW_HASH) {
      localStorage.setItem('vita_settle_ts', String(Date.now() + KEEP_MS));
      onAuthenticated();
    } else {
      setPwError('비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f6f9] dark:bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-slate-900 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="Vitamin Sign Logo" className="h-14 mb-5 dark:brightness-0 dark:invert" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">월말 정산</h1>
            <p className="text-[13px] text-slate-400 mt-1">관리자 전용 페이지입니다</p>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col">
            <label className="text-[13px] font-medium text-slate-600 dark:text-slate-300 mb-1.5">관리자 비밀번호</label>
            <div className="flex items-center border border-slate-300 dark:border-slate-600 dark:bg-slate-800 rounded px-3 h-11 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition mb-4">
              <IconLock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="password"
                value={pwInput}
                onChange={e => setPwInput(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="bg-transparent outline-none focus:ring-0 border-0 px-2.5 text-sm w-full text-slate-900 dark:text-slate-100"
                autoFocus
              />
            </div>
            {pwError && <p className="text-[13px] text-red-500 mb-3">{pwError}</p>}
            <button
              type="submit"
              className="h-11 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition"
            >
              들어가기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
