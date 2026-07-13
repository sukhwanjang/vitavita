import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileDrop } from '../types';

// DB에 아직 없는 컬럼(is_urgent/note)으로 인한 에러인지 판별
const isMissingColumnError = (message: string) =>
  /column|42703|schema cache/i.test(message);

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
    // 10초 주기 — 탭이 가려져 있어도 계속 확인 (출력요청 알림을 놓치지 않게)
    const interval = setInterval(fetchDrops, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchDrops();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchDrops]);

  const addDrop = async (
    path: string,
    creator: string | null,
    opts?: { urgent?: boolean; note?: string | null; requestId?: number | null }
  ) => {
    const payload: Record<string, unknown> = { path, creator };
    if (opts?.urgent) payload.is_urgent = true;
    if (opts?.note) payload.note = opts.note;
    if (opts?.requestId) payload.request_id = opts.requestId;

    let { error } = await supabase.from('file_drop').insert([payload]);

    // 컬럼이 아직 없으면 기본 필드만으로 재시도 (기능 저하만, 등록은 성공)
    if (error && isMissingColumnError(error.message) && (opts?.urgent || opts?.note || opts?.requestId)) {
      ({ error } = await supabase.from('file_drop').insert([{ path, creator }]));
      if (!error) {
        alert('등록은 됐지만 급함/메모/작업연결은 저장되지 않았습니다.\nSupabase에 is_urgent, note, request_id 컬럼을 추가해야 합니다.');
      }
    }

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

  // 실수로 지운 항목 복구 (원래 등록 시각 유지)
  const restoreDrop = async (drop: FileDrop) => {
    const payload: Record<string, unknown> = {
      path: drop.path,
      creator: drop.creator,
      created_at: drop.created_at,
    };
    if (drop.is_urgent) payload.is_urgent = drop.is_urgent;
    if (drop.note) payload.note = drop.note;
    if (drop.request_id) payload.request_id = drop.request_id;

    const { error } = await supabase.from('file_drop').insert([payload]);
    if (error) {
      alert('복구 실패: ' + error.message);
      return false;
    }
    await fetchDrops();
    return true;
  };

  // 작업 카드 완료 시 연결된 출력요청 자동 정리 (조용히, 실패해도 무시)
  const removeByRequest = async (requestId: number) => {
    try {
      await supabase.from('file_drop').delete().eq('request_id', requestId);
      await fetchDrops();
    } catch {
      // request_id 컬럼이 없는 등의 상황은 조용히 넘어감
    }
  };

  return { drops, error, addDrop, removeDrop, restoreDrop, removeByRequest };
}
