import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../lib/supabase';
import { RequestItem, Annotation } from '../types';
import { storagePathsOf } from '../utils/imageResize';

// 자동완성용 가벼운 이력 (업체·프로그램 이름만)
export interface HistoryPair {
  company: string;
  program: string;
  created_at: string;
}

const HISTORY_LIMIT = 600; // 자동완성에 쓰는 최근 등록 건수

// 불러오기 실패 문구 (인터넷 끊김·서버 정지는 쉬운 말로)
export const loadErrorText = (message: string) =>
  /failed to fetch|networkerror|load failed/i.test(message)
    ? '서버에 연결하지 못했습니다. 인터넷 연결을 확인해 주세요. 계속 안 되면 서버(Supabase)가 멈춘 것일 수 있습니다.'
    : `데이터를 불러오지 못했습니다: ${message}`;

interface Options {
  /** 등록 폼 자동완성용 이력을 처음 한 번 불러올지 (출력 전용 화면은 필요 없음) */
  history?: boolean;
}

export function useBoardData({ history: wantHistory = true }: Options = {}) {
  // 진행 중 + 삭제 표시된 작업 (완료된 작업은 여기 없다 — 완료 화면이 useCompletedList로 따로 받는다)
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false); // 첫 조회가 끝났는지 (빈 목록과 미조회 구분용)
  const [history, setHistory] = useState<HistoryPair[]>([]);
  // 출력대기에 연결돼 있지만 진행 목록에 없는(이미 완료된) 작업 — 필요할 때만 따로 받아 둔다
  const [linkedExtra, setLinkedExtra] = useState<RequestItem[]>([]);
  const triedLinkedRef = useRef<Set<number>>(new Set());

  const fetchRequests = useCallback(async () => {
    // 30초마다 도는 조회는 진행 중 작업만 받는다.
    // (예전엔 완료 500건을 매번 같이 받아 한 번에 0.5MB씩, 켜둔 PC 수만큼 트래픽이 쌓였다)
    let data: RequestItem[];
    try {
      const res = await supabase
        .from('request')
        .select('*')
        .eq('completed', false)
        .order('is_urgent', { ascending: false })
        .order('pickup_date', { ascending: true })
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false });
      if (res.error) throw new Error(res.error.message);
      data = (res.data ?? []) as RequestItem[];
    } catch (e) {
      setError(loadErrorText(e instanceof Error ? e.message : String(e)));
      setLoaded(true);
      return;
    }
    setError(null);

    // 삭제된 항목 10개 초과 시 오래된 것부터 Supabase에서 완전 삭제 (최근 삭제 10개는 유지)
    const deletedRows = data.filter(r => r.is_deleted);
    if (deletedRows.length > 10) {
      const toDelete = [...deletedRows]
        .sort((a, b) =>
          new Date(b.updated_at ?? b.created_at).getTime() -
          new Date(a.updated_at ?? a.created_at).getTime()
        )
        .slice(10);
      await Promise.all(toDelete.map(r =>
        supabase.from('request').delete().eq('id', r.id)
      ));
      // 행만 지우고 이미지 파일을 남겨두면 스토리지가 계속 불어난다 (1GB 한도를 이렇게 넘겼다)
      const files = toDelete.flatMap(r => storagePathsOf(r.image_url));
      if (files.length) {
        supabase.storage.from('request-images').remove(files).then(() => {});
      }
      const purged = new Set(toDelete.map(r => r.id));
      data = data.filter(r => !purged.has(r.id));
    }

    setRequests(data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    fetchRequests();
    // 새로고침 빈도 30초 — 탭이 화면에 보일 때만
    // (10초였을 때 켜둔 PC 수만큼 곱해져 egress가 감당이 안 됐다. 화면 전환 시엔 아래 onVisible이 즉시 당겨온다)
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchRequests();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchRequests();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchRequests]);

  // 자동완성용 이력: 화면을 열 때 한 번만, 이름 두 칸만 받는다 (실패해도 등록은 가능하므로 조용히 넘어감)
  useEffect(() => {
    if (!wantHistory) return;
    let cancelled = false;
    supabase
      .from('request')
      .select('company, program, created_at')
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT)
      .then(({ data }) => {
        if (!cancelled && data) setHistory(data as HistoryPair[]);
      });
    return () => { cancelled = true; };
  }, [wantHistory]);

  // 출력대기에 연결된 작업 중 진행 목록에 없는 것(이미 완료된 카드)을 한 번만 받아 온다
  const ensureLinked = useCallback(async (ids: number[]) => {
    const need = ids.filter(id => !triedLinkedRef.current.has(id));
    if (need.length === 0) return;
    need.forEach(id => triedLinkedRef.current.add(id));
    const { data, error } = await supabase.from('request').select('*').in('id', need);
    if (error) {
      // 다음 기회에 다시 시도할 수 있게 표시를 되돌린다
      need.forEach(id => triedLinkedRef.current.delete(id));
      return;
    }
    if (data && data.length) {
      setLinkedExtra(prev => {
        const have = new Set(prev.map(r => r.id));
        return [...prev, ...(data as RequestItem[]).filter(r => !have.has(r.id))];
      });
    }
  }, []);

  const handleComplete = async (id: number) => {
    const { error } = await supabase.from('request').update({
      completed: true,
      is_urgent: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) {
      alert('완료 처리 실패: ' + error.message);
      return;
    }

    await fetchRequests();
  };

  // 완료 → 진행 중으로 되돌리기
  const handleRecover = async (id: number) => {
    const { error } = await supabase.from('request').update({ completed: false }).eq('id', id);
    if (error) {
      alert('복구 실패: ' + error.message);
      return false;
    }
    await fetchRequests();
    return true;
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    // updated_at을 삭제 시각으로 기록해 "최근 삭제 10개 유지" 판단에 사용
    const { error } = await supabase
      .from('request')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      alert('삭제 실패: ' + error.message);
      return;
    }
    fetchRequests();
  };

  // 삭제함 → 진행 중으로 되살리기
  const handleRestoreDeleted = async (id: number) => {
    const { error } = await supabase.from('request').update({ is_deleted: false }).eq('id', id);
    if (error) {
      alert('되살리기 실패: ' + error.message);
      return false;
    }
    await fetchRequests();
    return true;
  };

  // 체크마크(핀·펜 선) 업데이트 함수
  const updateCheckMarks = async (id: number, checkMarks: Annotation[]) => {
    const { error } = await supabase
      .from('request')
      .update({ check_marks: checkMarks })
      .eq('id', id);

    if (error) {
      console.error('체크마크 저장 실패:', error.message);
      alert('검수 표시 저장 실패: ' + error.message);
      return false;
    }

    // 로컬 상태 즉시 업데이트
    const patch = (list: RequestItem[]) =>
      list.map(r => r.id === id ? { ...r, check_marks: checkMarks } : r);
    setRequests(patch);
    setLinkedExtra(patch);

    return true;
  };

  // 작업완료 토글 함수
  const handleWorkDone = async (id: number) => {
    const item = requests.find(r => r.id === id);
    if (!item) return;

    const newWorkDone = !item.is_work_done;

    const { error } = await supabase
      .from('request')
      .update({ is_work_done: newWorkDone })
      .eq('id', id);

    if (error) {
      console.error('작업완료 처리 실패:', error.message);
      alert('작업완료 표시 실패: ' + error.message);
      return;
    }

    // 로컬 상태 즉시 업데이트
    setRequests(prev =>
      prev.map(r => r.id === id ? { ...r, is_work_done: newWorkDone } : r)
    );
  };

  // 데이터 필터링
  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return {
    requests,
    error,
    loaded,
    history,
    linkedExtra,
    ensureLinked,
    fetchRequests,
    handleComplete,
    handleRecover,
    handleDelete,
    handleRestoreDeleted,
    updateCheckMarks,
    handleWorkDone,
    inProgress,
    deleted
  };
}
