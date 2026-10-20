'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { IconX, IconPrinter, IconPlus, IconTrash, IconEdit, IconSearch, IconCheck } from './ui/icons';

// 출력 색상 기록 게시판 — 거래처/프로그램별로 어떤 모드(프로파일·세팅)로 찍었는지
// 영구 보관해서, 재출력 때 전과 같은 색으로 맞추기 위한 용도.
interface ColorNote {
  id: number;
  company: string;
  program: string | null;
  mode: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ColorNotesModalProps {
  show: boolean;
  onClose: () => void;
  companySuggestions?: string[];
}

export default function ColorNotesModal({ show, onClose, companySuggestions = [] }: ColorNotesModalProps) {
  const [notes, setNotes] = useState<ColorNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // 새 기록 입력
  const [company, setCompany] = useState('');
  const [program, setProgram] = useState('');
  const [mode, setMode] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  // 수정 중인 행
  const [editId, setEditId] = useState<number | null>(null);
  const [eCompany, setECompany] = useState('');
  const [eProgram, setEProgram] = useState('');
  const [eMode, setEMode] = useState('');
  const [eNote, setENote] = useState('');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('color_notes')
      .select('*')
      .order('company', { ascending: true });
    if (error) {
      setLoadError(
        error.message.includes('does not exist') || error.message.includes('schema cache')
          ? '기록 테이블이 아직 없습니다. 관리자(클로드)에게 "색상 기록 테이블 만들어줘"라고 요청하세요.'
          : '불러오기 실패: ' + error.message
      );
      setNotes([]);
    } else {
      setNotes((data as ColorNote[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (show) fetchNotes();
  }, [show, fetchNotes]);

  if (!show) return null;

  const q = query.trim();
  const filtered = notes
    .filter(n =>
      !q ||
      n.company.includes(q) ||
      (n.program ?? '').includes(q) ||
      n.mode.includes(q) ||
      (n.note ?? '').includes(q)
    )
    .sort((a, b) =>
      a.company.localeCompare(b.company, 'ko') ||
      (a.program ?? '').localeCompare(b.program ?? '', 'ko')
    );

  const handleAdd = async () => {
    if (!company.trim() || !mode.trim()) {
      alert('업체명과 출력 모드는 꼭 적어주세요.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('color_notes').insert({
      company: company.trim(),
      program: program.trim() || null,
      mode: mode.trim(),
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) { alert('저장 실패: ' + error.message); return; }
    setCompany(''); setProgram(''); setMode(''); setNote('');
    fetchNotes();
  };

  const startEdit = (n: ColorNote) => {
    setEditId(n.id);
    setECompany(n.company);
    setEProgram(n.program ?? '');
    setEMode(n.mode);
    setENote(n.note ?? '');
  };

  const handleEditSave = async () => {
    if (editId === null) return;
    if (!eCompany.trim() || !eMode.trim()) {
      alert('업체명과 출력 모드는 꼭 적어주세요.');
      return;
    }
    const { error } = await supabase.from('color_notes').update({
      company: eCompany.trim(),
      program: eProgram.trim() || null,
      mode: eMode.trim(),
      note: eNote.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editId);
    if (error) { alert('수정 실패: ' + error.message); return; }
    setEditId(null);
    fetchNotes();
  };

  const handleDelete = async (n: ColorNote) => {
    if (!confirm(`"${n.company}${n.program ? ' · ' + n.program : ''}" 기록을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`)) return;
    const { error } = await supabase.from('color_notes').delete().eq('id', n.id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    fetchNotes();
  };

  const dateOf = (n: ColorNote) => {
    const d = new Date(n.updated_at ?? n.created_at);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  const inputCls = 'h-9 px-2.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 w-[92vw] max-w-[980px] h-[86vh] relative animate-fadein flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <IconPrinter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              출력 색상 기록
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">거래처·프로그램별로 어떤 모드로 찍었는지 적어두면, 재출력 때 전과 같은 색으로 맞출 수 있어요. 기록은 지우기 전까지 사라지지 않습니다.</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* 새 기록 입력 */}
        <div className="px-6 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="grid grid-cols-2 md:grid-cols-[1.2fr_1.2fr_1.6fr_1.6fr_auto] gap-2">
            <input className={inputCls} list="cn-companies" value={company} onChange={e => setCompany(e.target.value)} placeholder="업체명 *" />
            <datalist id="cn-companies">
              {companySuggestions.map(c => <option key={c} value={c} />)}
            </datalist>
            <input className={inputCls} value={program} onChange={e => setProgram(e.target.value)} placeholder="프로그램 (예: 현수막, 배너)" />
            <input className={inputCls} value={mode} onChange={e => setMode(e.target.value)} placeholder="출력 모드 * (예: 고품질 12패스·매트지 프로파일)" />
            <input className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="메모 (잉크·용지·주의점)" onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }} />
            <button
              onClick={handleAdd}
              disabled={saving}
              className="inline-flex items-center justify-center gap-1 h-9 px-4 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition disabled:opacity-50"
            >
              <IconPlus className="w-4 h-4" />
              기록
            </button>
          </div>
        </div>

        {/* 검색 */}
        <div className="px-6 py-3 shrink-0">
          <div className="flex items-center max-w-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 h-9 focus-within:border-blue-500 transition">
            <IconSearch className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="업체·프로그램·모드 검색"
              className="bg-transparent outline-none border-0 px-2 text-sm w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">지우기</button>
            )}
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loadError ? (
            <div className="mt-4 rounded border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-4 py-3">{loadError}</div>
          ) : loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-slate-400 py-12">
              {q ? '검색 결과가 없습니다.' : '아직 기록이 없습니다. 위에서 첫 기록을 남겨보세요.'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="py-2 pr-3 w-[16%]">업체</th>
                  <th className="py-2 pr-3 w-[14%]">프로그램</th>
                  <th className="py-2 pr-3 w-[28%]">출력 모드</th>
                  <th className="py-2 pr-3">메모</th>
                  <th className="py-2 pr-3 w-[80px]">기록일</th>
                  <th className="py-2 w-[76px]"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(n => (
                  editId === n.id ? (
                    <tr key={n.id} className="border-b border-slate-50 dark:border-slate-800/60 bg-blue-50/50 dark:bg-blue-950/30">
                      <td className="py-2 pr-2"><input className={inputCls + ' w-full'} value={eCompany} onChange={e => setECompany(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputCls + ' w-full'} value={eProgram} onChange={e => setEProgram(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputCls + ' w-full'} value={eMode} onChange={e => setEMode(e.target.value)} /></td>
                      <td className="py-2 pr-2"><input className={inputCls + ' w-full'} value={eNote} onChange={e => setENote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleEditSave(); }} /></td>
                      <td className="py-2 pr-2 text-xs text-slate-400">{dateOf(n)}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={handleEditSave} title="저장" className="inline-flex items-center justify-center w-7 h-7 rounded bg-blue-600 text-white hover:bg-blue-700 transition"><IconCheck className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditId(null)} title="취소" className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"><IconX className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={n.id} className="border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-slate-100">{n.company}</td>
                      <td className="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{n.program ?? '—'}</td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center rounded bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2 py-0.5">{n.mode}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500 dark:text-slate-400 text-[13px]">{n.note ?? ''}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-400 tabular-nums">{dateOf(n)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(n)} title="수정" className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"><IconEdit className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(n)} title="삭제" className="inline-flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 transition"><IconTrash className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
