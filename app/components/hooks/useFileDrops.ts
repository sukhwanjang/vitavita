import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileDrop } from '../types';

export function useFileDrops() {
  const [drops, setDrops] = useState<FileDrop[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDrops = useCallback(async () => {
    const { data, error } = await supabase
      .from('file_drop')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }
    setError(null);
    setDrops(data ?? []);
  }, []);

  useEffect(() => {
    fetchDrops();
    // 현황판과 같은 10초 주기, 탭이 보일 때만
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchDrops();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchDrops();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchDrops]);

  const addDrop = async (path: string, creator: string | null) => {
    const { error } = await supabase.from('file_drop').insert([{ path, creator }]);
    if (error) {
      alert('파일 등록 실패: ' + error.message);
      return false;
    }
    await fetchDrops();
    return true;
  };

  const removeDrop = async (id: number) => {
    const { error } = await supabase.from('file_drop').delete().eq('id', id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    await fetchDrops();
  };

  return { drops, error, addDrop, removeDrop };
}
