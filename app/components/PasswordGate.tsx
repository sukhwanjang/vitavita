'use client';
import { useState, useEffect } from 'react';
import { IconLock } from './ui/icons';

interface PasswordGateProps {
  onAuthenticated: (isAuth: boolean) => void;
}

export default function PasswordGate({ onAuthenticated }: PasswordGateProps) {
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    const ts = localStorage.getItem('vitapass_ts');
    if (ts && Number(ts) > Date.now()) {
      onAuthenticated(true);
    }
  }, [onAuthenticated]);

  const handlePwSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwInput === 'vita0070') {
      localStorage.setItem('vitapass_ts', String(Date.now() + 1000 * 60 * 60 * 24 * 7)); // 일주일 유지
      onAuthenticated(true);
      setPwError('');
    } else {
      setPwError('비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f6f9] px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-md shadow-sm border border-slate-200 px-8 py-10">
          <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="Vitamin Sign Logo" className="h-14 mb-5" />
            <h1 className="text-lg font-bold text-slate-900">비타민사인 현황판</h1>
            <p className="text-[13px] text-slate-400 mt-1">작업 현황 관리 시스템</p>
          </div>
          <form onSubmit={handlePwSubmit} className="flex flex-col">
            <label className="text-[13px] font-medium text-slate-600 mb-1.5">비밀번호</label>
            <div className="flex items-center border border-slate-300 rounded px-3 h-11 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition mb-4">
              <IconLock className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="password"
                value={pwInput}
                onChange={e => setPwInput(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="bg-transparent outline-none focus:ring-0 border-0 px-2.5 text-sm w-full"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full h-11 bg-blue-600 text-white font-semibold rounded hover:bg-blue-700 active:bg-blue-800 transition text-sm"
            >
              로그인
            </button>
            {pwError && <div className="text-red-600 text-[13px] mt-3 text-center">{pwError}</div>}
          </form>
        </div>
        <p className="text-[11px] text-slate-400 mt-4 text-center">비밀번호는 7일마다 다시 입력해야 합니다.</p>
      </div>
    </div>
  );
}
