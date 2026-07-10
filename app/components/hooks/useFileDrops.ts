import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileDrop } from '../types';

// DB에 아직 없는 컬럼(is_urgent/note/printer)으로 인한 에러인지 판별
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

  const addDrop = async (
    path: string,
    creator: string | null,
    opts?: { urgent?: boolean; note?: string | null }
  ) => {
    const payload: Record<string, unknown> = { path, creator };
    if (opts?.urgent) payload.is_urgent = true;
    if (opts?.note) payload.note = opts.note;

    let { error } = await supabase.from('file_drop').insert([payload]);

    // 컬럼이 아직 없으면 기본 필드만으로 재시도 (기능 저하만, 등록은 성공)
    if (error && isMissingColumnError(error.message) && (opts?.urgent || opts?.note)) {
      ({ error } = await supabase.from('file_drop').insert([{ path, creator }]));
      if (!error) {
        alert('등록은 됐지만 급함/메모는 저장되지 않았습니다.\nSupabase에 is_urgent, note 컬럼을 추가해야 합니다.');
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
    if (drop.printer) payload.printer = drop.printer;

    const { error } = await supabase.from('file_drop').insert([payload]);
    if (error) {
      alert('복구 실패: ' + error.message);
      return false;
    }
    await fetchDrops();
    return true;
  };

  // 출력중 상태 설정/해제 (printer = 출력하는 사람 이름 | null)
  const setPrinter = async (id: number, printer: string | null) => {
    const { error } = await supabase.from('file_drop').update({ printer }).eq('id', id);
    if (error) {
      if (isMissingColumnError(error.message)) {
        alert('출력중 표시 기능을 쓰려면 Supabase에 printer 컬럼을 추가해야 합니다.');
      } else {
        alert('출력 상태 변경 실패: ' + error.message);
      }
      return;
    }
    await fetchDrops();
  };

  return { drops, error, addDrop, removeDrop, restoreDrop, setPrinter };
}
