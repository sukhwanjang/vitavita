import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { RequestItem, Annotation } from '../types';

export function useBoardData() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    // 진행중/삭제 항목은 전부, 완료 항목은 최근 500개만 가져온다 (완료가 쌓여도 느려지지 않게)
    const [active, done] = await Promise.all([
      supabase
        .from('request')
        .select('*')
        .eq('completed', false)
        .order('is_urgent', { ascending: false })
        .order('pickup_date', { ascending: true })
        .order('updated_at', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase
        .from('request')
        .select('*')
        .eq('completed', true)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(500),
    ]);

    const loadError = active.error || done.error;
    if (loadError) {
      setError(`데이터 로딩 실패: ${loadError.message}`);
      return;
    }

    const data = [...(active.data ?? []), ...(done.data ?? [])];

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
    }

    setRequests(data);
  }, []);

  useEffect(() => {
    fetchRequests();
    // 새로고침 빈도 10초 — 탭이 화면에 보일 때만
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchRequests();
    }, 10000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchRequests();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchRequests]);

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

  const handleRecover = async (id: number) => {
    await supabase.from('request').update({ completed: false }).eq('id', id);
    fetchRequests();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    // updated_at을 삭제 시각으로 기록해 "최근 삭제 10개 유지" 판단에 사용
    await supabase.from('request').update({ is_deleted: true, updated_at: new Date().toISOString() }).eq('id', id);
    fetchRequests();
  };

  // 체크마크(핀·펜 선) 업데이트 함수
  const updateCheckMarks = async (id: number, checkMarks: Annotation[]) => {
    const { error } = await supabase
      .from('request')
      .update({ check_marks: checkMarks })
      .eq('id', id);
    
    if (error) {
      console.error('체크마크 저장 실패:', error.message);
      return false;
    }
    
    // 로컬 상태 즉시 업데이트
    setRequests(prev => 
      prev.map(r => r.id === id ? { ...r, check_marks: checkMarks } : r)
    );
    
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
      return;
    }
    
    // 로컬 상태 즉시 업데이트
    setRequests(prev => 
      prev.map(r => r.id === id ? { ...r, is_work_done: newWorkDone } : r)
    );
  };

  // 데이터 필터링
  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const completed = requests
    .filter(r => !r.is_deleted && r.completed)
    .sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.created_at).getTime();
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  const deleted = requests.filter(r => r.is_deleted);

  return {
    requests,
    error,
    fetchRequests,
    handleComplete,
    handleRecover,
    handleDelete,
    updateCheckMarks,
    handleWorkDone,
    inProgress,
    completed,
    deleted
  };
} 