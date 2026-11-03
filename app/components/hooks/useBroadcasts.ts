import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';

// 층간 방송 한 건
export interface Broadcast {
  id: number;
  message: string;
  sender: string | null;
  client_id: string | null;
  acked_by: string | null;
  acked_at: string | null;
  created_at: string;
}

const KEEP_DAYS = 7;       // 7일 지난 방송은 자동 삭제
const LOAD_HOURS = 24;     // 최근 24시간치만 불러옴
const POLL_MS = 10000;     // 실시간이 막혀도 10초마다는 확인

// 테이블이 아직 없을 때 나는 에러인지 판별 (SQL 실행 안내용)
const isMissingTableError = (message: string) =>
  /relation .* does not exist|42P01|schema cache|Could not find the table/i.test(message);

// 이 브라우저(탭) 식별자 — 내가 보낸 방송은 내 화면에서 울리지 않게
export const getClientId = () => {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem('vitavita_bc_client');
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem('vitavita_bc_client', id);
    }
    return id;
  } catch {
    return 'anon';
  }
};

export function useBroadcasts() {
  const [items, setItems] = useState<Broadcast[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cleanedRef = useRef(false);
  const missingRef = useRef(false);

  const fetchRecent = useCallback(async () => {
    const since = new Date(Date.now() - LOAD_HOURS * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .gte('created_at', since)
      .order('id', { ascending: false })
      .limit(40);

    if (error) {
      if (isMissingTableError(error.message)) { setTableMissing(true); missingRef.current = true; }
      else setError(error.message);
      return;
    }
    setTableMissing(false);
    missingRef.current = false;
    setError(null);
    setItems(data ?? []);

    // 오래된 방송 정리 (세션당 1회, 실패해도 무시)
    if (!cleanedRef.current) {
      cleanedRef.current = true;
      const cutoff = new Date(Date.now() - KEEP_DAYS * 86400 * 1000).toISOString();
      supabase.from('broadcasts').delete().lt('created_at', cutoff).then(() => {});
    }
  }, []);

  useEffect(() => {
    fetchRecent();

    // 실시간 구독 (INSERT/UPDATE 오면 다시 불러옴)
    const channel = supabase
      .channel('broadcasts-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, () => {
        fetchRecent();
      })
      .subscribe();

    // 보조 폴링 — 실시간이 안 붙어도 10초 안에는 받도록
    // 테이블이 아직 없으면(SQL 미실행) 1분에 한 번만 확인
    let tick = 0;
    const interval = setInterval(() => {
      tick++;
      if (document.visibilityState !== 'visible') return;
      if (missingRef.current && tick % 6 !== 0) return;
      fetchRecent();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchRecent();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [fetchRecent]);

  // 방송 보내기
  const send = async (message: string, sender: string | null) => {
    const text = message.trim();
    if (!text) return false;
    const { error } = await supabase
      .from('broadcasts')
      .insert([{ message: text, sender: sender || null, client_id: getClientId() }]);
    if (error) {
      if (isMissingTableError(error.message)) {
        setTableMissing(true);
        alert('방송 테이블이 아직 없습니다.\nSupabase SQL Editor에서 broadcast_setup.sql을 실행해 주세요.');
      } else {
        alert('방송 실패: ' + error.message);
      }
      return false;
    }
    await fetchRecent();
    return true;
  };

  // 확인 처리 (받은 쪽에서 누름 → 보낸 쪽 화면에 "확인됨" 표시)
  const ack = async (id: number, who: string | null) => {
    // 화면에 바로 반영
    setItems(prev => prev.map(b =>
      b.id === id && !b.acked_by
        ? { ...b, acked_by: who || '확인', acked_at: new Date().toISOString() }
        : b
    ));
    const { error } = await supabase
      .from('broadcasts')
      .update({ acked_by: who || '확인', acked_at: new Date().toISOString() })
      .eq('id', id)
      .is('acked_by', null);
    if (error) setError(error.message);
    await fetchRecent();
  };

  return { items, tableMissing, error, send, ack, refresh: fetchRecent };
}
