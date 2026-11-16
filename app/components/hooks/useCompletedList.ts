import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { RequestItem } from '../types';
import { loadErrorText } from './useBoardData';

const PAGE = 28;          // 한 번에 받는 완료 카드 수
const SEARCH_DELAY = 300; // 검색어 입력이 멈춘 뒤 조회까지 기다리는 시간(ms)

// 검색어를 PostgREST or() 안에 안전하게 넣기
// 1) %, _ 는 "아무 글자" 뜻이라 글자 그대로 찾도록 앞에 \ 를 붙이고
// 2) 쉼표·괄호가 들어가도 깨지지 않게 따옴표로 감싼다 (따옴표 안의 \ 와 " 는 한 번 더 \ 를 붙인다)
const likePattern = (q: string) => {
  const literal = q.replace(/[\\%_]/g, '\\$&');
  return `"*${literal.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}*"`;
};

/**
 * 완료된 작업 목록 — 완료 화면에서만 쓴다.
 *
 * 예전엔 모든 화면이 완료 500건을 30초마다 통째로 받았고, 500건보다 오래된 작업은 찾을 수 없었다.
 * 지금은 완료 화면에서만, 28건씩, 검색은 DB 전체에서 한다 (업체·프로그램·작업자·메모).
 */
export function useCompletedList(enabled: boolean, query: string) {
  const [items, setItems] = useState<RequestItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seqRef = useRef(0);        // 늦게 도착한 옛 응답을 버리기 위한 번호
  const queryRef = useRef('');     // 실제 조회에 쓰는 검색어 (입력이 멈춘 뒤 반영)
  const lenRef = useRef(0);
  lenRef.current = items.length;

  const load = useCallback(async (from: number, to: number, mode: 'replace' | 'append') => {
    const seq = ++seqRef.current;
    setLoading(true);
    const q = queryRef.current;
    try {
      let builder = supabase
        .from('request')
        .select('*', { count: 'exact' })
        .eq('completed', true)
        .not('is_deleted', 'is', true);
      if (q) {
        const pat = likePattern(q);
        builder = builder.or(
          `company.ilike.${pat},program.ilike.${pat},creator.ilike.${pat},note.ilike.${pat}`
        );
      }
      const res = await builder
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .range(from, to);
      if (seq !== seqRef.current) return; // 더 새로운 조회가 이미 나갔다
      if (res.error) throw new Error(res.error.message);
      const rows = (res.data ?? []) as RequestItem[];
      setError(null);
      setTotal(res.count ?? null);
      setItems(prev => {
        if (mode === 'replace') return rows;
        const have = new Set(prev.map(r => r.id));
        return [...prev, ...rows.filter(r => !have.has(r.id))];
      });
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(loadErrorText(e instanceof Error ? e.message : String(e)));
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, []);

  // 처음 열 때 + 검색어가 바뀔 때: 첫 묶음부터 다시
  const startedRef = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    // 처음엔 바로, 그 뒤로는 입력이 잠깐 멈췄을 때 조회 (글자마다 조회하지 않게)
    const delay = startedRef.current ? SEARCH_DELAY : 0;
    startedRef.current = true;
    const t = setTimeout(() => {
      queryRef.current = query.trim();
      load(0, PAGE - 1, 'replace');
    }, delay);
    return () => clearTimeout(t);
  }, [enabled, query, load]);

  // 지금까지 받은 만큼 다시 받기 (복구·삭제 뒤, 다른 창 갔다 돌아왔을 때)
  const refresh = useCallback(() => {
    if (!enabled) return Promise.resolve();
    return load(0, Math.max(lenRef.current, PAGE) - 1, 'replace');
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [enabled, refresh]);

  const hasMore = total !== null && items.length < total;

  // 다음 묶음 받기 (화면 맨 아래에 닿으면 호출)
  const loadMore = useCallback(() => {
    if (!enabled || loading || !hasMore) return;
    load(items.length, items.length + PAGE - 1, 'append');
  }, [enabled, loading, hasMore, items.length, load]);

  // 화면에 떠 있는 카드만 바로 고치기 (검수 표시 저장 직후 등)
  const patchLocal = useCallback((id: number, patch: Partial<RequestItem>) => {
    setItems(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  return { items, total, loading, error, hasMore, loadMore, refresh, patchLocal };
}
