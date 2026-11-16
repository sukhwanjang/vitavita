import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

// 공지 한 건 (상단에 흘러가는 빨간 글씨)
export interface Notice {
  id: number;
  message: string;
  created_by: string | null;
  created_at: string;
}

const POLL_MS = 60000;      // 실시간이 막혀도 1분 안에는 바뀐 공지를 받는다
const MAX_NOTICES = 20;

// 테이블이 아직 없을 때 나는 에러인지 판별 (notice_setup.sql 실행 안내용)
const isMissingTableError = (message: string) =>
  /relation .* does not exist|42P01|schema cache|Could not find the table/i.test(message);

export function useNotices() {
  const [items, setItems] = useState<Notice[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const missingRef = useRef(false);

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase
      .from('notices')
      .select('*')
      .order('id', { ascending: true })
      .limit(MAX_NOTICES);

    if (error) {
      if (isMissingTableError(error.message)) {
        setTableMissing(true);
        missingRef.current = true;
      }
      // 그 밖의 오류(인터넷 끊김 등)는 마지막으로 받은 공지를 그대로 둔다
      setLoaded(true);
      return;
    }
    setTableMissing(false);
    missingRef.current = false;
    setItems((data ?? []) as Notice[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchAll();

    // 실시간 구독 (누가 공지를 고치면 바로 다시 불러옴)
    const channel = supabase
      .channel('notices-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => {
        fetchAll();
      })
      .subscribe();

    // 보조 폴링 — 테이블이 아직 없으면(SQL 미실행) 5분에 한 번만 확인
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      if (document.visibilityState !== 'visible') return;
      if (missingRef.current && tick % 5 !== 0) return;
      fetchAll();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !missingRef.current) fetchAll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  // 아래 세 함수는 실패하면 오류 문구를, 성공하면 null을 돌려준다
  const add = async (message: string, by: string | null) => {
    const text = message.trim();
    if (!text) return '공지 내용을 적어 주세요.';
    const { error } = await supabase.from('notices').insert([{ message: text, created_by: by || null }]);
    if (error) {
      if (isMissingTableError(error.message)) { setTableMissing(true); missingRef.current = true; }
      return error.message;
    }
    await fetchAll();
    return null;
  };

  const update = async (id: number, message: string) => {
    const text = message.trim();
    if (!text) return '공지 내용을 적어 주세요.';
    const { error } = await supabase.from('notices').update({ message: text }).eq('id', id);
    if (error) return error.message;
    await fetchAll();
    return null;
  };

  const remove = async (id: number) => {
    const { error } = await supabase.from('notices').delete().eq('id', id);
    if (error) return error.message;
    await fetchAll();
    return null;
  };

  return { items, loaded, tableMissing, add, update, remove };
}
