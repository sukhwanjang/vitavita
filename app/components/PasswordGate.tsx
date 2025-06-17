'use client';
import { useState, useEffect } from 'react';

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
      localStorage.setItem('vitapass_ts', String(Date.now() + 1000 * 60 * 60 * 24)); // 24시간 유지
      onAuthenticated(true);
      setPwError('');
    } else {
      setPwError('비밀번호가 올바르지 않습니다.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100">
      <div className="flex flex-col items-center bg-white rounded-3xl shadow-2xl px-10 py-12 border border-gray-100">
        <img src="/logo.png" alt="Vitamin Sign Logo" className="h-20 mb-6" />
        <form onSubmit={handlePwSubmit} className="flex flex-col items-center w-64">
          <input
            type="password"
            value={pwInput}
            onChange={e => setPwInput(e.target.value)}
            placeholder="비밀번호를 입력하세요"
            className="rounded-xl border border-gray-300 px-4 py-3 text-lg text-center focus:ring-2 focus:ring-blue-400 transition mb-3 w-full"
            autoFocus
          />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 rounded-xl shadow hover:bg-blue-700 transition text-lg">입장하기</button>
          {pwError && <div className="text-red-500 text-sm mt-2">{pwError}</div>}
          <div className="text-xs text-gray-400 mt-4">비밀번호는 5시간마다 다시 입력해야 합니다.</div>
        </form>
      </div>
    </div>
  );
} 