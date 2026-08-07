'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../components/hooks/useAuth';
import PasswordGate from '../components/PasswordGate';
import UploadModal from './UploadModal';
import { formatAmount, formatWhen } from './excel';
import { SettlementItem, ParsedRow, ItemType, InvoiceStatus, WORKER_NAMES } from './types';
import { IconSearch, IconUpload } from '../components/ui/icons';

const nowMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// 기본값: 지난달 (월말 정산은 보통 지난달 분)
const prevMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function SettlementPage() {
  const router = useRouter();
  const { authChecked, isAuthed, handleAuthentication } = useAuth();

  const [items, setItems] = useState<SettlementItem[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [month, setMonth] = useState('');
  const [tab, setTab] = useState<ItemType>('미수');
  const [search, setSearch] = useState('');
  const [worker, setWorker] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [error, setError] = useState('');
  const [needSetup, setNeedSetup] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setWorker(localStorage.getItem('vitavita_creator') ?? '');
  }, []);

  const pickWorker = (name: string) => {
    setWorker(name);
    localStorage.setItem('vitavita_creator', name);
  };

  // 존재하는 월 목록
  const fetchMonths = useCallback(async () => {
    const { data, error: err } = await supabase.from('settlement_items').select('month');
    if (err) {
      if (/relation|does not exist|schema cache/i.test(err.message)) setNeedSetup(true);
      else setError(`월 목록 로딩 실패: ${err.message}`);
      setLoaded(true);
      return;
    }
    setNeedSetup(false);
    const uniq = Array.from(new Set((data ?? []).map(r => r.month))).sort().reverse();
    setMonths(uniq);
    setMonth(cur => cur || uniq[0] || prevMonth());
    setLoaded(true);
  }, []);

  const fetchItems = useCallback(async (m: string) => {
    if (!m) return;
    const { data, error: err } = await supabase
      .from('settlement_items')
      .select('*')
      .eq('month', m)
      .order('sort_order', { ascending: true })
      .order('company', { ascending: true });
    if (err) {
      if (/relation|does not exist|schema cache/i.test(err.message)) setNeedSetup(true);
      return;
    }
    setItems(data ?? []);
  }, []);

  useEffect(() => { fetchMonths(); }, [fetchMonths]);
  useEffect(() => { if (month) fetchItems(month); }, [month, fetchItems]);

  // 10초마다 새로고침 (다른 사람 체크 실시간 반영)
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible' && month) fetchItems(month);
    }, 10000);
    return () => clearInterval(t);
  }, [month, fetchItems]);

  // ── 상태 변경 ──────────────────────────────────────
  const requireWorker = () => {
    if (!worker) {
      alert('먼저 화면 위에서 본인 이름을 선택해주세요.');
      return false;
    }
    return true;
  };

  const patchLocal = (id: string, patch: Partial<SettlementItem>) =>
    setItems(list => list.map(it => (it.id === id ? { ...it, ...patch } : it)));

  const updateRow = async (id: string, patch: Partial<SettlementItem>) => {
    patchLocal(id, patch);
    const { error: err } = await supabase
      .from('settlement_items')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) {
      setError(`저장 실패: ${err.message}`);
      fetchItems(month);
    }
  };

  const toggleStatement = (it: SettlementItem) => {
    if (!requireWorker()) return;
    const next = !it.statement_sent;
    updateRow(it.id, {
      statement_sent: next,
      statement_by: next ? worker : null,
      statement_at: next ? new Date().toISOString() : null,
    });
  };

  const setInvoice = (it: SettlementItem, status: InvoiceStatus) => {
    if (!requireWorker()) return;
    const clear = status === '미발행';
    updateRow(it.id, {
      invoice_status: status,
      invoice_by: clear ? null : worker,
      invoice_at: clear ? null : new Date().toISOString(),
    });
  };

  const togglePaid = (it: SettlementItem) => {
    if (!requireWorker()) return;
    const next = !it.paid;
    updateRow(it.id, {
      paid: next,
      paid_by: next ? worker : null,
      paid_at: next ? new Date().toISOString() : null,
    });
  };

  const saveMemo = (it: SettlementItem, memo: string) => {
    if (memo === it.memo) return;
    updateRow(it.id, { memo });
  };

  const deleteRow = async (it: SettlementItem) => {
    if (!confirm(`'${it.company}' 행을 삭제할까요?`)) return;
    setItems(list => list.filter(x => x.id !== it.id));
    const { error: err } = await supabase.from('settlement_items').delete().eq('id', it.id);
    if (err) { setError(`삭제 실패: ${err.message}`); fetchItems(month); }
  };

  // ── 엑셀 업로드 저장 ────────────────────────────────
  const handleUploadConfirm = async (m: string, rows: ParsedRow[]) => {
    const { data: existing, error: exErr } = await supabase
      .from('settlement_items')
      .select('id, item_type, company')
      .eq('month', m);
    if (exErr) throw new Error(exErr.message);

    const byKey = new Map((existing ?? []).map(e => [`${e.item_type}|${e.company}`, e.id]));
    const inserts: Record<string, unknown>[] = [];
    const updates: { id: string; amount: number; biz_no: string; sort_order: number }[] = [];

    rows.forEach((r, i) => {
      const id = byKey.get(`${r.itemType}|${r.company}`);
      if (id) {
        // 이미 있는 업체: 금액만 갱신, 사이트에서 체크한 상태는 보존
        updates.push({ id, amount: r.amount, biz_no: r.bizNo, sort_order: i });
      } else {
        const now = new Date().toISOString();
        inserts.push({
          month: m,
          item_type: r.itemType,
          company: r.company,
          amount: r.amount,
          biz_no: r.bizNo,
          statement_sent: r.statementSent,
          statement_by: r.statementSent ? '엑셀표시' : null,
          statement_at: r.statementSent ? now : null,
          invoice_status: r.invoiceStatus,
          invoice_by: r.invoiceStatus !== '미발행' ? '엑셀표시' : null,
          invoice_at: r.invoiceStatus !== '미발행' ? now : null,
          memo: r.memo,
          sort_order: i,
        });
      }
    });

    if (inserts.length) {
      const { error: insErr } = await supabase.from('settlement_items').insert(inserts);
      if (insErr) throw new Error(insErr.message);
    }
    for (const u of updates) {
      const { error: upErr } = await supabase
        .from('settlement_items')
        .update({ amount: u.amount, biz_no: u.biz_no, sort_order: u.sort_order, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (upErr) throw new Error(upErr.message);
    }

    setMonth(m);
    await fetchMonths();
    await fetchItems(m);
  };

  // ── 화면용 데이터 ───────────────────────────────────
  const tabItems = useMemo(() => items.filter(it => it.item_type === tab), [items, tab]);
  const visible = useMemo(
    () => (search ? tabItems.filter(it => it.company.includes(search)) : tabItems),
    [tabItems, search],
  );
  const misuCount = items.filter(it => it.item_type === '미수').length;
  const mijiCount = items.filter(it => it.item_type === '미지급').length;

  const stat = {
    total: tabItems.length,
    stmt: tabItems.filter(it => it.statement_sent).length,
    inv: tabItems.filter(it => it.invoice_status === '발행완료').length,
    invReq: tabItems.filter(it => it.invoice_status === '발행요청').length,
    paid: tabItems.filter(it => it.paid).length,
    amount: tabItems.reduce((s, it) => s + Number(it.amount || 0), 0),
    unpaidAmount: tabItems.filter(it => !it.paid).reduce((s, it) => s + Number(it.amount || 0), 0),
  };

  const monthOptions = months.includes(month) || !month ? months : [month, ...months];

  if (!authChecked) return null;
  if (!isAuthed) return <PasswordGate onAuthenticated={handleAuthentication} />;

  const chip = (active: boolean, color: string) =>
    `inline-flex items-center justify-center h-8 px-3 rounded text-[13px] font-medium border transition whitespace-nowrap ${
      active ? color : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-400'
    }`;

  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-slate-950">
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
          <div className="flex items-center h-16 gap-4">
            <button className="flex items-center gap-3 shrink-0" onClick={() => router.push('/')}>
              <img src="/logo.png" alt="Vitamin Sign" className="h-9 object-contain dark:brightness-0 dark:invert" />
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-[15px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">월말 정산</span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">명세표 · 세금계산서 · 입금 체크</span>
              </span>
            </button>

            <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

            {/* 검색 */}
            <div className="flex items-center flex-1 max-w-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 h-10 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition">
              <IconSearch className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="업체명 검색"
                className="bg-transparent outline-none border-0 focus:ring-0 px-2.5 text-sm w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <button
                onClick={() => router.push('/')}
                className="h-9 px-3.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                ← 현황판
              </button>
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm"
              >
                <IconUpload className="w-4 h-4" />
                엑셀 업로드
              </button>
            </div>
          </div>

          {/* 이름 선택 + 월/탭 */}
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mr-1">내 이름</span>
            {WORKER_NAMES.map(name => (
              <button
                key={name}
                onClick={() => pickWorker(name)}
                className={`h-7 px-2.5 rounded text-xs font-medium border transition ${
                  worker === name
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-blue-300'
                }`}
              >
                {name}
              </button>
            ))}

            <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

            <select
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="h-8 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-[13px] font-medium text-slate-700 dark:text-slate-200"
            >
              {monthOptions.length === 0 && <option value="">-</option>}
              {monthOptions.map(m => (
                <option key={m} value={m}>{m.replace('-', '년 ')}월</option>
              ))}
            </select>

            <div className="flex items-center rounded border border-slate-200 dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setTab('미수')}
                className={`h-8 px-3 text-[13px] font-medium transition ${tab === '미수' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                미수 (받을돈) {misuCount}
              </button>
              <button
                onClick={() => setTab('미지급')}
                className={`h-8 px-3 text-[13px] font-medium transition ${tab === '미지급' ? 'bg-amber-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
              >
                미지급 (줄돈) {mijiCount}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-5">
        {needSetup && (
          <div className="mb-4 p-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 text-sm text-amber-800 dark:text-amber-200">
            <p className="font-semibold mb-1">⚙️ 최초 1회 설정이 필요합니다</p>
            <p>Supabase 대시보드 → SQL Editor에서 프로젝트의 <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">settlement_setup.sql</code> 내용을 실행해주세요. 실행 후 새로고침하면 됩니다.</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 rounded border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 text-sm text-red-700 dark:text-red-300 flex justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="font-medium">✕</button>
          </div>
        )}

        {/* 진행 현황 요약 */}
        {stat.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[
              { label: '명세표 발송', done: stat.stmt, extra: '' },
              { label: '세금계산서 발행', done: stat.inv, extra: stat.invReq ? `요청 ${stat.invReq}건 대기` : '' },
              { label: '입금 완료', done: stat.paid, extra: `미입금 ${formatAmount(stat.unpaidAmount)}원` },
              { label: `${tab} 합계`, done: -1, extra: `${formatAmount(stat.amount)}원 · ${stat.total}곳` },
            ].map(card => (
              <div key={card.label} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-1">{card.label}</p>
                {card.done >= 0 ? (
                  <>
                    <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      {card.done}<span className="text-sm font-medium text-slate-400"> / {stat.total}</span>
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${card.done === stat.total ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${stat.total ? (card.done / stat.total) * 100 : 0}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-8">{card.extra}</p>
                )}
                {card.done >= 0 && card.extra && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5">{card.extra}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 목록 */}
        {loaded && !needSetup && items.length === 0 && (
          <div className="text-center py-24 text-slate-400">
            <p className="text-lg mb-2">아직 등록된 정산 데이터가 없습니다</p>
            <p className="text-sm">오른쪽 위 <b>엑셀 업로드</b> 버튼으로 얼마경리 미수미지급잔액표를 올려주세요.</p>
          </div>
        )}

        {visible.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-400 dark:text-slate-500">
                  <th className="px-4 py-2.5 font-medium">업체명</th>
                  <th className="px-3 py-2.5 font-medium text-right">금액</th>
                  <th className="px-3 py-2.5 font-medium text-center">명세표</th>
                  <th className="px-3 py-2.5 font-medium text-center">세금계산서</th>
                  <th className="px-3 py-2.5 font-medium text-center">입금</th>
                  <th className="px-3 py-2.5 font-medium">메모</th>
                  <th className="px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map(it => {
                  const rowDone = it.statement_sent && it.invoice_status === '발행완료' && it.paid;
                  return (
                    <tr
                      key={it.id}
                      className={`border-b border-slate-100 dark:border-slate-800 last:border-0 transition ${
                        rowDone ? 'bg-emerald-50/60 dark:bg-emerald-900/10' : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="px-4 py-2">
                        <p className="font-medium text-slate-800 dark:text-slate-200">{it.company}</p>
                        {it.biz_no && <p className="text-[11px] text-slate-400">{it.biz_no}</p>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatAmount(Number(it.amount || 0))}원
                      </td>

                      {/* 명세표 */}
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => toggleStatement(it)}
                          className={chip(it.statement_sent, 'bg-blue-600 text-white border-blue-600')}
                          title={it.statement_sent ? `${it.statement_by ?? ''} · ${formatWhen(it.statement_at)}` : '클릭하면 발송 처리'}
                        >
                          {it.statement_sent ? '보냄 ✓' : '안보냄'}
                        </button>
                        {it.statement_sent && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{it.statement_by} {formatWhen(it.statement_at)}</p>
                        )}
                      </td>

                      {/* 세금계산서 */}
                      <td className="px-3 py-2 text-center">
                        <div className="inline-flex rounded border border-slate-200 dark:border-slate-600 overflow-hidden">
                          {(['미발행', '발행요청', '발행완료'] as InvoiceStatus[]).map(s => (
                            <button
                              key={s}
                              onClick={() => setInvoice(it, s)}
                              className={`h-8 px-2 text-[12px] font-medium transition ${
                                it.invoice_status === s
                                  ? s === '발행완료' ? 'bg-emerald-600 text-white'
                                    : s === '발행요청' ? 'bg-amber-500 text-white'
                                    : 'bg-slate-500 text-white'
                                  : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-600'
                              }`}
                            >
                              {s === '미발행' ? '미발행' : s === '발행요청' ? '요청' : '발행 ✓'}
                            </button>
                          ))}
                        </div>
                        {it.invoice_status !== '미발행' && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{it.invoice_by} {formatWhen(it.invoice_at)}</p>
                        )}
                      </td>

                      {/* 입금 */}
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => togglePaid(it)}
                          className={chip(it.paid, 'bg-emerald-600 text-white border-emerald-600')}
                        >
                          {it.paid ? '입금 ✓' : '대기'}
                        </button>
                        {it.paid && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{it.paid_by} {formatWhen(it.paid_at)}</p>
                        )}
                      </td>

                      {/* 메모 */}
                      <td className="px-3 py-2">
                        <input
                          defaultValue={it.memo}
                          key={`${it.id}-${it.memo}`}
                          onBlur={e => saveMemo(it, e.target.value.trim())}
                          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          placeholder="메모"
                          className="w-full min-w-[120px] bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-600 focus:border-blue-400 focus:ring-0 rounded px-2 h-8 text-[13px] text-slate-600 dark:text-slate-300 placeholder:text-slate-300 dark:placeholder:text-slate-600 outline-none transition"
                        />
                      </td>

                      <td className="px-2 py-2 text-center">
                        <button
                          onClick={() => deleteRow(it)}
                          className="text-slate-300 hover:text-red-500 text-sm px-1"
                          title="행 삭제"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {items.length > 0 && visible.length === 0 && (
          <p className="text-center py-16 text-slate-400 text-sm">
            {search ? `'${search}' 검색 결과가 없습니다.` : '이 구분에는 데이터가 없습니다.'}
          </p>
        )}
      </main>

      {showUpload && (
        <UploadModal
          defaultMonth={month || prevMonth()}
          onClose={() => setShowUpload(false)}
          onConfirm={handleUploadConfirm}
        />
      )}
    </div>
  );
}
