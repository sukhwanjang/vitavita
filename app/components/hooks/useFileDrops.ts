import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { FileDrop } from '../types';

// DB에 아직 없는 컬럼(is_urgent/note)으로 인한 에러인지 판별
const isMissingColumnError = (message: string) =>
  /column|42703|schema cache/i.test(message);

const DONE_KEEP = 50; // 완료 보관 개수 (초과분은 오래된 것부터 자동 삭제)

// 경로에서 파일 이름만 뽑기 (중복 업로드 검사용 — 폴더가 달라도 이름이 같으면 같은 파일로 봄)
const baseName = (p: string) => {
  const seg = p.trim().replace(/[\\/]+$/, '').split(/[\\/]/);
  return (seg[seg.length - 1] || p).trim();
};

const timeAgo = (iso: string) => {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

export function useFileDrops() {
  const [drops, setDrops] = useState<FileDrop[]>([]);
  const [doneDrops, setDoneDrops] = useState<FileDrop[]>([]);
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

    const all = data ?? [];
    const doneRows = all
      .filter(r => r.done)
      .sort((a, b) =>
        new Date(b.done_at ?? b.created_at).getTime() -
        new Date(a.done_at ?? a.created_at).getTime()
      );

    // 완료 보관 50개 초과분은 오래된 것부터 완전 삭제
    if (doneRows.length > DONE_KEEP) {
      const excess = doneRows.slice(DONE_KEEP).map(r => r.id);
      supabase.from('file_drop').delete().in('id', excess).then(() => {});
    }

    setDrops(all.filter(r => !r.done));
    setDoneDrops(doneRows.slice(0, DONE_KEEP));
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
    // ── 중복 업로드 검사: 같은 이름 파일이 이미 올라와 있으면 알려줌 ──
    const name = baseName(path);
    const nameLc = name.toLowerCase();
    const dup = drops.find(d => baseName(d.path).toLowerCase() === nameLc);
    if (dup) {
      const who = dup.creator ? ` · ${dup.creator}` : '';
      const goAhead = window.confirm(
        `이미 업로드한 파일입니다!\n\n${name}\n(${timeAgo(dup.created_at)}${who} · 지금 출력대기에 있음)\n\n그래도 한 번 더 올릴까요?`
      );
      if (!goAhead) return false;
    } else {
      const dupDone = doneDrops.find(d => baseName(d.path).toLowerCase() === nameLc);
      if (dupDone) {
        const goAhead = window.confirm(
          `이미 출력 완료 처리된 파일입니다.\n\n${name}\n(${timeAgo(dupDone.done_at ?? dupDone.created_at)} 완료됨)\n\n다시 올릴까요?`
        );
        if (!goAhead) return false;
      }
    }

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

  // 완료 처리: 삭제하지 않고 완료 보관함으로 이동
  const removeDrop = async (id: number) => {
    const { error } = await supabase
      .from('file_drop')
      .update({ done: true, done_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('완료 처리 실패: ' + error.message);
      return;
    }
    await fetchDrops();
  };

  // 복구: 완료 보관함 → 대기 목록 (실행 취소와 보관함 [복구] 공용)
  const restoreDrop = async (drop: FileDrop) => {
    const { data, error } = await supabase
      .from('file_drop')
      .update({ done: false, done_at: null })
      .eq('id', drop.id)
      .select('id');

    // done 컬럼이 없거나(구버전 삭제 방식) 행이 이미 사라진 경우 → 재등록으로 복구
    if ((error && isMissingColumnError(error.message)) || (!error && (data ?? []).length === 0)) {
      const payload: Record<string, unknown> = {
        path: drop.path,
        creator: drop.creator,
        created_at: drop.created_at,
      };
      if (drop.is_urgent) payload.is_urgent = drop.is_urgent;
      if (drop.note) payload.note = drop.note;
      if (drop.request_id) payload.request_id = drop.request_id;
      const { error: insErr } = await supabase.from('file_drop').insert([payload]);
      if (insErr) {
        alert('복구 실패: ' + insErr.message);
        return false;
      }
    } else if (error) {
      alert('복구 실패: ' + error.message);
      return false;
    }
    await fetchDrops();
    return true;
  };

  // 작업 카드 완료 시 연결된 출력요청 자동 정리 (완료 보관으로, 실패해도 무시)
  const removeByRequest = async (requestId: number) => {
    try {
      await supabase
        .from('file_drop')
        .update({ done: true, done_at: new Date().toISOString() })
        .eq('request_id', requestId)
        .eq('done', false);
      await fetchDrops();
    } catch {
      // 실패해도 조용히 넘어감 (수동 완료로 정리 가능)
    }
  };

  return { drops, doneDrops, error, addDrop, removeDrop, restoreDrop, removeByRequest };
}
