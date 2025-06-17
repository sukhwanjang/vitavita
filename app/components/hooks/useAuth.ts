import { useState, useEffect } from 'react';

export function useAuth() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const ts = localStorage.getItem('vitapass_ts');
    if (ts && Number(ts) > Date.now()) {
      setIsAuthed(true);
    }
    setAuthChecked(true);
  }, []);

  // 5시간 만료 후 자동 로그아웃
  useEffect(() => {
    if (!isAuthed) return;
    const ts = localStorage.getItem('vitapass_ts');
    if (!ts) return;
    const timeout = setTimeout(() => {
      setIsAuthed(false);
      localStorage.removeItem('vitapass_ts');
    }, Number(ts) - Date.now());
    return () => clearTimeout(timeout);
  }, [isAuthed]);

  const handleAuthentication = (isAuth: boolean) => {
    setIsAuthed(isAuth);
  };

  return {
    authChecked,
    isAuthed,
    handleAuthentication
  };
} 