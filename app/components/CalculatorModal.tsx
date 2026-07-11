'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PRICE_ITEMS } from './priceData';
import { FULL_PRICE_TABLE, REF_NOTES, RefGroup } from './priceTableData';
import { handlePrintStatement, StatementItem } from './utils/printUtils';
import { IconX, IconCalculator, IconPlus, IconTrash, IconCopy, IconCheck, IconFileText, IconPrinter, IconRestore } from './ui/icons';

interface CalcRow {
  id: number;
  name: string;
  unitPrice: string; // 자동 조회되지만 협의가로 수정 가능
  w: string;         // 가로 (m)
  h: string;         // 세로 (m)
  qty: string;       // 수량
  perUnit: boolean;  // true = 개당 품목
}

let nextId = 1;
const emptyRow = (): CalcRow => ({ id: nextId++, name: '', unitPrice: '', w: '', h: '', qty: '1', perUnit: false });

const num = (s: string) => {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

// 엑셀과 동일: 1,000원 단위 올림
const roundUp1000 = (n: number) => (n > 0 ? Math.ceil(n / 1000) * 1000 : 0);

const rowAmount = (r: CalcRow) => {
  const unit = num(r.unitPrice);
  const raw = r.perUnit ? unit * num(r.qty) : num(r.w) * num(r.h) * unit * num(r.qty);
  return roundUp1000(raw);
};

const fmt = (n: number) => n.toLocaleString('ko-KR');

// 저장된 견적 (Supabase quote 테이블)
interface SavedQuote {
  id: number;
  company: string;
  program: string | null;
  items: CalcRow[];
  supply: number;
  vat: number;
  total: number;
  creator: string | null;
  created_at: string;
}

// 계산 행 → 명세표 항목 변환
const toStatementItems = (calcRows: CalcRow[]): StatementItem[] =>
  calcRows
    .filter(r => rowAmount(r) > 0)
    .map(r => {
      const qty = num(r.qty) || 1;
      return {
        name: r.name || '품명없음',
        spec: r.perUnit ? '' : `${r.w}*${r.h}m`,
        qty,
        unitPrice: Math.round(rowAmount(r) / qty),
        amount: rowAmount(r),
      };
    });

// 참고용 단가표 렌더링 (종류 셀은 세로 병합)
function RefTable({ groups }: { groups: RefGroup[] }) {
  return (
    <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm border-collapse bg-white dark:bg-slate-900">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 w-20">종류</th>
            <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700">품명</th>
            <th className="px-3 py-2 text-center text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 w-16">규격</th>
            <th className="px-3 py-2 text-right text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 w-24">단가</th>
            <th className="px-3 py-2 text-left text-[11px] font-bold text-slate-400 dark:text-slate-500 border-b border-slate-200 dark:border-slate-700 w-36">비고</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(g =>
            g.rows.map((r, i) => (
              <tr key={`${g.category}-${r.name}-${i}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition">
                {i === 0 && (
                  <td
                    rowSpan={g.rows.length}
                    className="px-3 py-2 align-top text-[13px] font-bold text-slate-700 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40"
                  >
                    {g.category}
                  </td>
                )}
                <td className="px-3 py-1.5 text-[13px] text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800">{r.name}</td>
                <td className="px-3 py-1.5 text-[12px] text-center text-slate-400 border-b border-slate-100 dark:border-slate-800">{r.spec ?? ''}</td>
                <td className="px-3 py-1.5 text-[13px] text-right font-semibold tabular-nums text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800">
                  {r.price > 0 ? fmt(r.price) : '—'}
                </td>
                <td className="px-3 py-1.5 text-[12px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{r.note ?? ''}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface CalculatorModalProps {
  show: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ show, onClose }: CalculatorModalProps) {
  const [rows, setRows] = useState<CalcRow[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [focusedRow, setFocusedRow] = useState<number | null>(null);
  // 자동완성 목록 위치 (스크롤 영역에 잘리지 않게 화면 기준 좌표로 띄움)
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'calc' | 'price' | 'saved'>('calc');
  const [company, setCompany] = useState('');
  const [program, setProgram] = useState('');
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [quoteFilter, setQuoteFilter] = useState('');

  if (!show) return null;

  const fetchQuotes = async () => {
    const { data, error } = await supabase
      .from('quote')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) {
      setQuotesError(error.message);
      return;
    }
    setQuotesError(null);
    setQuotes(data ?? []);
  };

  const switchView = (v: 'calc' | 'price' | 'saved') => {
    setView(v);
    if (v === 'saved') fetchQuotes();
  };

  const update = (id: number, patch: Partial<CalcRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const pickItem = (id: number, itemName: string) => {
    const item = PRICE_ITEMS.find(i => i.name === itemName);
    if (!item) return;
    update(id, {
      name: item.name,
      unitPrice: String(item.price),
      perUnit: item.perUnit,
      ...(item.perUnit ? { w: '', h: '' } : {}),
    });
    setFocusedRow(null);
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (id: number) =>
    setRows(prev => (prev.length > 1 ? prev.filter(r => r.id !== id) : [emptyRow()]));
  const clearAll = () => setRows([emptyRow(), emptyRow(), emptyRow()]);

  const activeRows = rows.filter(r => rowAmount(r) > 0);
  const supply = activeRows.reduce((sum, r) => sum + rowAmount(r), 0);
  const vat = Math.round(supply / 10);
  const total = supply + vat;

  const handleCopy = async () => {
    const lines = activeRows.map(r => {
      const spec = r.perUnit
        ? `${num(r.qty)}개`
        : `${r.w}×${r.h}m${num(r.qty) > 1 ? ` ×${r.qty}` : ''}`;
      return `${r.name || '(품명없음)'} ${spec} — ${fmt(rowAmount(r))}원`;
    });
    const text = [
      '[비타민사인 견적]',
      ...lines,
      `공급가액 ${fmt(supply)}원 / VAT ${fmt(vat)}원`,
      `합계 ${fmt(total)}원 (VAT 포함)`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const suggestionsFor = (r: CalcRow) => {
    if (!r.name) return PRICE_ITEMS;
    return PRICE_ITEMS.filter(i => i.name.includes(r.name) && i.name !== r.name);
  };

  // ── 저장 / 불러오기 / 명세표 인쇄 ──
  const handleSave = async () => {
    if (!company.trim()) { alert('업체명을 입력해주세요.'); return; }
    if (activeRows.length === 0) { alert('저장할 항목이 없습니다.'); return; }
    const { error } = await supabase.from('quote').insert([{
      company: company.trim(),
      program: program.trim() || null,
      items: rows.filter(r => rowAmount(r) > 0),
      supply,
      vat,
      total,
      creator: localStorage.getItem('vitavita_creator'),
    }]);
    if (error) {
      if (/quote|42P01|schema cache/i.test(error.message)) {
        alert('견적 저장 기능을 쓰려면 Supabase에 quote 테이블을 만들어야 합니다.\n(관리자에게 문의)');
      } else {
        alert('저장 실패: ' + error.message);
      }
      return;
    }
    setSaveMsg('저장됨!');
    setTimeout(() => setSaveMsg(null), 2500);
  };

  const handlePrint = () => {
    if (activeRows.length === 0) { alert('인쇄할 항목이 없습니다.'); return; }
    handlePrintStatement({
      company: company.trim(),
      program: program.trim() || null,
      items: toStatementItems(rows),
      supply, vat, total,
    });
  };

  const loadQuote = (q: SavedQuote) => {
    setRows(q.items.map(it => ({ ...it, id: nextId++ })));
    setCompany(q.company);
    setProgram(q.program ?? '');
    setView('calc');
  };

  const printQuote = (q: SavedQuote) => {
    handlePrintStatement({
      company: q.company,
      program: q.program,
      items: toStatementItems(q.items),
      supply: q.supply, vat: q.vat, total: q.total,
      date: new Date(q.created_at),
    });
  };

  const deleteQuote = async (q: SavedQuote) => {
    if (!window.confirm(`'${q.company}' 견적을 삭제할까요?`)) return;
    const { error } = await supabase.from('quote').delete().eq('id', q.id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    fetchQuotes();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 w-[92vw] max-w-[1300px] h-[85vh] relative animate-fadein flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <IconCalculator className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              단가 계산기
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {view === 'calc'
                ? '품명을 고르면 단가가 자동으로 들어갑니다. 단가는 직접 고칠 수 있어요. 금액은 1,000원 단위 올림.'
                : view === 'price'
                  ? '참고용 전체 단가표 — 계산은 계산기 탭에서.'
                  : '저장한 견적 목록 — 불러오거나 거래명세표로 인쇄할 수 있어요.'}
            </p>
          </div>

          {/* 탭 */}
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded p-1 ml-2">
            {([['calc', '계산기'], ['price', '단가표'], ['saved', '저장된 견적']] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => switchView(key)}
                className={`h-8 px-4 rounded text-[13px] font-semibold transition ${
                  view === key
                    ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            className="ml-auto flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
            onClick={onClose}
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* ── 단가표 탭 ── */}
        {view === 'price' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4 items-start">
              <RefTable groups={FULL_PRICE_TABLE} />
              <div className="space-y-3">
                {REF_NOTES.map(n => (
                  <div key={n.title} className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      <IconFileText className="w-3.5 h-3.5 text-slate-400" />
                      {n.title}
                    </p>
                    <ul className="space-y-0.5">
                      {n.lines.map((line, i) => (
                        <li key={i} className="text-[12px] text-slate-500 dark:text-slate-400 tabular-nums">{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 저장된 견적 탭 ── */}
        {view === 'saved' && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {quotesError ? (
              <p className="text-sm text-red-500">
                견적 목록을 불러올 수 없습니다. ({quotesError})<br />
                <span className="text-xs text-slate-400">Supabase에 quote 테이블이 아직 없을 수 있어요.</span>
              </p>
            ) : (
              <>
                <input
                  type="text"
                  value={quoteFilter}
                  onChange={e => setQuoteFilter(e.target.value)}
                  placeholder="업체명·프로그램명 검색"
                  className="w-full max-w-xs rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 h-10 text-sm text-slate-900 dark:text-slate-100 mb-3"
                />
                {quotes.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">저장된 견적이 없습니다. 계산기 탭에서 계산 후 [저장]을 눌러보세요.</p>
                ) : (
                  <div className="space-y-1.5">
                    {quotes
                      .filter(q => !quoteFilter || q.company.includes(quoteFilter) || (q.program ?? '').includes(quoteFilter))
                      .map(q => (
                        <div key={q.id} className="flex items-center gap-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/60 transition">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                              {q.company}
                              {q.program && <span className="ml-2 font-medium text-slate-500 dark:text-slate-400">{q.program}</span>}
                            </p>
                            <p className="text-[11px] text-slate-400 tabular-nums">
                              {new Date(q.created_at).toLocaleString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })}
                              {q.creator && ` · ${q.creator}`}
                              {` · ${q.items.length}개 항목`}
                            </p>
                          </div>
                          <span className="text-sm font-bold tabular-nums text-blue-700 dark:text-blue-400 shrink-0">{fmt(q.total)}원</span>
                          <span className="flex gap-1 shrink-0">
                            <button
                              onClick={() => loadQuote(q)}
                              title="계산기로 불러오기"
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                            >
                              <IconRestore className="w-3 h-3" />
                              불러오기
                            </button>
                            <button
                              onClick={() => printQuote(q)}
                              title="거래명세표 인쇄"
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition"
                            >
                              <IconPrinter className="w-3 h-3" />
                              명세표
                            </button>
                            <button
                              onClick={() => deleteQuote(q)}
                              title="삭제"
                              className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── 계산기 탭 ── */}
        {view === 'calc' && (
        <>
        <div className="flex-1 overflow-y-auto px-6 py-4" onScroll={() => setFocusedRow(null)}>
          {/* 업체명 / 프로그램명 (저장·명세표용) */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              type="text"
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="업체명 (저장·명세표에 사용)"
              className="w-full sm:max-w-[260px] rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 h-10 text-[15px] font-semibold text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <input
              type="text"
              value={program}
              onChange={e => setProgram(e.target.value)}
              placeholder="프로그램명 (선택)"
              className="w-full sm:max-w-[260px] rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 h-10 text-[15px] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
          </div>

          {/* 열 제목 */}
          <div className="hidden md:grid grid-cols-[1fr_130px_100px_100px_80px_140px_36px] gap-2.5 pb-2 text-xs font-semibold text-slate-400 select-none">
            <span>품명</span>
            <span className="text-right">단가</span>
            <span className="text-center">가로(m)</span>
            <span className="text-center">세로(m)</span>
            <span className="text-center">수량</span>
            <span className="text-right">금액</span>
            <span />
          </div>

          <div className="space-y-2">
            {rows.map(r => {
              const amount = rowAmount(r);
              const sugg = focusedRow === r.id ? suggestionsFor(r) : [];
              return (
                <div key={r.id} className="relative grid grid-cols-2 md:grid-cols-[1fr_130px_100px_100px_80px_140px_36px] gap-2.5 items-center">
                  {/* 품명 + 자동완성 */}
                  <div className="relative col-span-2 md:col-span-1">
                    <input
                      type="text"
                      value={r.name}
                      onChange={e => update(r.id, { name: e.target.value })}
                      onFocus={e => {
                        setFocusedRow(r.id);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const width = Math.max(rect.width, 320);
                        const left = Math.min(rect.left, window.innerWidth - width - 8);
                        setAnchor({ top: rect.bottom + 4, left: Math.max(left, 8), width });
                      }}
                      onBlur={() => setTimeout(() => setFocusedRow(prev => (prev === r.id ? null : prev)), 150)}
                      placeholder="품명 검색 (예: 현수막, 유포...)"
                      className="w-full rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3 h-10 text-[15px] text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                    />
                    {focusedRow === r.id && anchor && sugg.length > 0 && (
                      <div
                        style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: anchor.width }}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg z-[60] max-h-56 overflow-y-auto">
                        {sugg.slice(0, 40).map(item => (
                          <button
                            key={item.name}
                            onMouseDown={e => { e.preventDefault(); pickItem(r.id, item.name); }}
                            className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950 transition border-b border-slate-50 dark:border-slate-700 last:border-b-0"
                          >
                            <span className="inline-flex items-center h-4 px-1 rounded-sm bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-400 text-[9px] font-bold shrink-0">
                              {item.category}
                            </span>
                            <span className="flex-1 truncate">{item.name}</span>
                            <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                              {fmt(item.price)}{item.perUnit ? '/개' : '/㎡'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 단가 */}
                  <input
                    type="number"
                    value={r.unitPrice}
                    onChange={e => update(r.id, { unitPrice: e.target.value })}
                    placeholder="단가"
                    className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 h-10 text-[15px] text-right text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />

                  {/* 가로/세로 (개당 품목은 비활성) */}
                  <input
                    type="number"
                    value={r.perUnit ? '' : r.w}
                    onChange={e => update(r.id, { w: e.target.value })}
                    placeholder={r.perUnit ? '—' : '가로'}
                    disabled={r.perUnit}
                    className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 h-10 text-[15px] text-center text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition disabled:bg-slate-50 dark:disabled:bg-slate-800/40 disabled:text-slate-300 dark:disabled:text-slate-600"
                  />
                  <input
                    type="number"
                    value={r.perUnit ? '' : r.h}
                    onChange={e => update(r.id, { h: e.target.value })}
                    placeholder={r.perUnit ? '—' : '세로'}
                    disabled={r.perUnit}
                    className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 h-10 text-[15px] text-center text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition disabled:bg-slate-50 dark:disabled:bg-slate-800/40 disabled:text-slate-300 dark:disabled:text-slate-600"
                  />

                  {/* 수량 */}
                  <input
                    type="number"
                    value={r.qty}
                    onChange={e => update(r.id, { qty: e.target.value })}
                    placeholder="수량"
                    min={1}
                    className="rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 h-10 text-[15px] text-center text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
                  />

                  {/* 금액 */}
                  <span className={`text-right text-base font-bold tabular-nums ${amount > 0 ? 'text-slate-900 dark:text-slate-100' : 'text-slate-300 dark:text-slate-700'}`}>
                    {amount > 0 ? `${fmt(amount)}원` : '—'}
                  </span>

                  {/* 행 삭제 */}
                  <button
                    onClick={() => removeRow(r.id)}
                    title="행 삭제"
                    className="flex items-center justify-center w-8 h-8 rounded text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition"
                  >
                    <IconTrash className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1 h-8 px-3 rounded border border-dashed border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
            >
              <IconPlus className="w-3 h-3" />
              행 추가
            </button>
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 h-8 px-3 rounded text-xs font-semibold text-slate-400 hover:text-red-500 transition"
            >
              전체 지우기
            </button>
          </div>
        </div>

        {/* 합계 푸터 */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-md shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-5 text-sm">
              <span className="text-slate-500 dark:text-slate-400">공급가액 <b className="text-slate-900 dark:text-slate-100 tabular-nums">{fmt(supply)}</b>원</span>
              <span className="text-slate-500 dark:text-slate-400">VAT <b className="text-slate-900 dark:text-slate-100 tabular-nums">{fmt(vat)}</b>원</span>
              <span className="text-base font-bold text-blue-700 dark:text-blue-400 tabular-nums">합계 {fmt(total)}원</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                disabled={activeRows.length === 0}
                className={`inline-flex items-center gap-1.5 h-9 px-4 rounded text-sm font-semibold border transition ${
                  copied
                    ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40'
                }`}
                title="견적 내용을 복사해서 카톡·문자에 붙여넣을 수 있어요"
              >
                {copied ? <IconCheck className="w-3.5 h-3.5" /> : <IconCopy className="w-3.5 h-3.5" />}
                {copied ? '복사됨!' : '견적 복사'}
              </button>
              <button
                onClick={handlePrint}
                disabled={activeRows.length === 0}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded text-sm font-semibold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition disabled:opacity-40"
                title="실제 사용하는 거래명세표 양식으로 인쇄 (프린터에서 PDF 저장도 가능)"
              >
                <IconPrinter className="w-3.5 h-3.5" />
                명세표 인쇄
              </button>
              <button
                onClick={handleSave}
                disabled={activeRows.length === 0}
                className={`inline-flex items-center gap-1.5 h-9 px-5 rounded text-sm font-semibold transition disabled:opacity-40 ${
                  saveMsg
                    ? 'bg-emerald-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
                }`}
                title="업체명과 함께 저장 — [저장된 견적] 탭에서 다시 열 수 있어요"
              >
                {saveMsg ? <IconCheck className="w-3.5 h-3.5" /> : null}
                {saveMsg ?? '저장'}
              </button>
            </div>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
