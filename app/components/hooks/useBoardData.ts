import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import { RequestItem } from '../types';

export function useBoardData() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('request')
      .select('*')
      .order('is_deleted', { ascending: true })
      .order('completed', { ascending: true })
      .order('is_urgent', { ascending: false })
      .order('pickup_date', { ascending: true })
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false });
  
    if (error) {
      setError(`데이터 로딩 실패: ${error.message}`);
      return;
    }
  
    // 삭제된 항목 10개 초과 시 Supabase에서 완전 삭제
    const deleted = data.filter(r => r.is_deleted);
    if (deleted.length > 10) {
      const toDelete = deleted.slice(10);
      await Promise.all(toDelete.map(r =>
        supabase.from('request').delete().eq('id', r.id)
      ));
    }
  
    setRequests(data || []);
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
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
    await supabase.from('request').update({ is_deleted: true }).eq('id', id);
    fetchRequests();
  };

  // 데이터 필터링
  const inProgress = requests.filter(r => !r.is_deleted && !r.completed && r.is_just_upload !== true);
  const completed = requests
    .filter(r => !r.is_deleted && r.completed)
    .sort((a, b) => {
      const dateA = a.updated_at ? new Date(a.updated_at).getTime() : new Date(a.created_at).getTime();
      const dateB = b.updated_at ? new Date(b.updated_at).getTime() : new Date(b.created_at).getTime();
      return dateB - dateA;
    });
  const deleted = requests.filter(r => r.is_deleted);
  const justUpload = requests.filter(r => r.is_just_upload);

  return {
    requests,
    error,
    fetchRequests,
    handleComplete,
    handleRecover,
    handleDelete,
    inProgress,
    completed,
    deleted,
    justUpload
  };
} 