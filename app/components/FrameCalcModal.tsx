'use client';
import { useState } from 'react';
import {
  FrameSpec, FrameSettings, DEFAULT_SETTINGS,
  framePieces, pieceList, optimize, fmtMm,
} from './frameCalc';
import { handlePrintFrameCut } from './utils/printUtils';
import { IconX, IconFrame, IconPlus, IconTrash, IconPrinter } from './ui/icons';

interface FrameCalcModalProps {
  show: boolean;
  onClose: () => void;
}

let nextId = 1;

const kindDot: Record<string, string> = {
  가로: 'bg-blue-500', 세로: 'bg-emerald-500', 지지대: 'bg-amber-500',
};

export default function FrameCalcModal({ show, onClose }: FrameCalcModalProps) {
  const [settings, setSettings] = useState<FrameSettings>(DEFAULT_SETTINGS);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [supports, setSupports] = useState(2);
  const [frames, setFrames] = useState<FrameSpec[]>([]);

  if (!show) return null;

  const num = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n; };
  const setS = (patch: Partial<FrameSettings>) => setSettings(prev => ({ ...prev, ...patch }));

  const addFrame = () => {
    const w = num(width), h = num(height);
    if (w <= 0 || h <= 0) return;
    setFrames(prev => [...prev, { id: nextId++, width: w, height: h, supports }]);
    setWidth(''); setHeight('');
  };
  const removeFrame = (id: number) => setFrames(prev => prev.filter(f => f.id !== id));
  const clearAll = () => setFrames([]);

  // 전체 조각 통합 → 최적 재단
  const allPieces = frames.flatMap(f => pieceList(f, settings));
  const result = optimize(allPieces, settings);
  const totalPieces = allPieces.length;

  const handlePrint = () => {
    if (frames.length === 0) return;
    handlePrintFrameCut({
      company: null,
      frames: frames.map(f => {
        const p = framePieces(f, settings);
        return { width: f.width, height: f.height, supports: f.supports, horizLen: p.horizLen, vertLen: p.vertLen, supportLen: p.supportLen };
      }),
      stocks: result.stocks.map(st => ({
        cuts: st.cuts.map(c => ({ len: c.len, kind: c.kind })),
        leftover: st.leftover,
      })),
      stockLength: settings.stockLength,
      stockCount: result.stockCount,
      efficiency: result.efficiency,
      totalLeftover: result.totalLeftover,
      woodWidth: settings.woodWidth,
      kerf: settings.kerf,
    });
  };

  const inputCls = 'rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2.5 h-9 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition';
  const settingCls = 'w-20 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-2 h-8 text-sm text-right tabular-nums text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 w-[92vw] max-w-[1100px] h-[86vh] relative animate-fadein flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 gap-4">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <IconFrame className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              액자 틀 재단 계산기
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">액자 크기를 담으면 원장 재단을 최적으로 계산합니다. 여러 개 담으면 자투리를 줄여 함께 재단해요.</p>
          </div>
          <button
            className="ml-auto flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
            onClick={onClose}
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {/* 설정 바 */}
        <div className="flex items-center flex-wrap gap-x-5 gap-y-2 px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 shrink-0 text-xs text-slate-500 dark:text-slate-400">
          <label className="flex items-center gap-1.5">목재 폭
            <input type="number" value={settings.woodWidth} onChange={e => setS({ woodWidth: num(e.target.value) })} className={settingCls} /><span>mm</span>
          </label>
          <label className="flex items-center gap-1.5">원장 길이
            <input type="number" value={settings.stockLength} onChange={e => setS({ stockLength: num(e.target.value) })} className={settingCls} /><span>mm</span>
          </label>
          <label className="flex items-center gap-1.5">톱날 여유
            <input type="number" value={settings.kerf} onChange={e => setS({ kerf: num(e.target.value) })} className={settingCls} /><span>mm</span>
          </label>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-[1fr_1fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-100 dark:divide-slate-800">
          {/* 좌: 입력 + 담은 목록 */}
          <div className="px-6 py-4">
            <div className="flex items-end gap-2 mb-4">
              <label className="flex flex-col text-[11px] font-medium text-slate-500 dark:text-slate-400">가로 (mm)
                <input type="number" value={width} onChange={e => setWidth(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFrame(); }} placeholder="1000" className={`${inputCls} w-24 mt-1`} autoFocus />
              </label>
              <span className="pb-2 text-slate-300">×</span>
              <label className="flex flex-col text-[11px] font-medium text-slate-500 dark:text-slate-400">세로 (mm)
                <input type="number" value={height} onChange={e => setHeight(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addFrame(); }} placeholder="1450" className={`${inputCls} w-24 mt-1`} />
              </label>
              <label className="flex flex-col text-[11px] font-medium text-slate-500 dark:text-slate-400">지지대
                <select value={supports} onChange={e => setSupports(Number(e.target.value))} className={`${inputCls} w-16 mt-1`}>
                  {[0, 1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button onClick={addFrame} className="inline-flex items-center gap-1 h-9 px-4 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 transition">
                <IconPlus className="w-4 h-4" />담기
              </button>
            </div>

            {frames.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-300 dark:text-slate-600">
                <IconFrame className="w-8 h-8" />
                <p className="text-xs text-slate-400">액자 크기를 입력하고 담아보세요</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400">담은 액자 {frames.length}개 · 조각 {totalPieces}개</span>
                  <button onClick={clearAll} className="text-[11px] font-semibold text-slate-400 hover:text-red-500 transition">전체 비우기</button>
                </div>
                <div className="space-y-1.5">
                  {frames.map((f, i) => {
                    const p = framePieces(f, settings);
                    return (
                      <div key={f.id} className="flex items-center gap-3 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                        <span className="text-[11px] font-bold text-slate-400 shrink-0">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtMm(f.width)} × {fmtMm(f.height)}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            가로 {fmtMm(p.horizLen)}×2 · 세로 {fmtMm(p.vertLen)}×2
                            {p.supportQty > 0 && ` · 지지대 ${fmtMm(p.supportLen)}×${p.supportQty}`}
                          </p>
                        </div>
                        <button onClick={() => removeFrame(f.id)} className="shrink-0 flex items-center justify-center w-7 h-7 rounded text-slate-300 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 transition">
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* 우: 재단 결과 */}
          <div className="px-6 py-4">
            {frames.length === 0 ? (
              <p className="text-sm text-slate-400 py-12 text-center">담은 액자가 여기서 원장 재단으로 계산됩니다</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: '필요 원장', value: `${result.stockCount}개`, color: 'text-slate-900 dark:text-slate-100' },
                    { label: '자재 효율', value: `${result.efficiency}%`, color: result.efficiency >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400' },
                    { label: '총 자투리', value: `${fmtMm(result.totalLeftover)}`, color: 'text-slate-500 dark:text-slate-400' },
                  ].map(k => (
                    <div key={k.label} className="rounded border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 px-3 py-2">
                      <p className="text-[10px] font-medium text-slate-400">{k.label}</p>
                      <p className={`text-lg font-bold tabular-nums ${k.color}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {result.oversized.length > 0 && (
                  <p className="mb-3 text-xs text-red-600 dark:text-red-400 font-semibold">
                    ⚠️ 원장({fmtMm(settings.stockLength)}mm)보다 긴 조각 {result.oversized.length}개는 재단할 수 없어요.
                  </p>
                )}

                {/* 재단도 미리보기 */}
                <div className="space-y-2 mb-4">
                  {result.stocks.map((st, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 shrink-0 w-12">원장 {i + 1}</span>
                      <div className="flex-1 flex h-8 rounded border border-slate-300 dark:border-slate-600 overflow-hidden">
                        {st.cuts.map((c, j) => (
                          <div key={j} className={`flex items-center justify-center ${kindDot[c.kind]} text-white text-[9px] font-bold border-r border-white/50 last:border-r-0 overflow-hidden`}
                            style={{ width: `${(c.len / settings.stockLength) * 100}%` }}
                            title={`${c.kind} ${fmtMm(c.len)}`}>
                            {fmtMm(c.len)}
                          </div>
                        ))}
                        {st.leftover > 0 && (
                          <div className="flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-400 text-[9px] font-semibold overflow-hidden"
                            style={{ width: `${(st.leftover / settings.stockLength) * 100}%` }}
                            title={`자투리 ${fmtMm(st.leftover)}`}>
                            {fmtMm(st.leftover)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />가로</span>
                  <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />세로</span>
                  <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />지지대</span>
                  <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600 inline-block" />자투리</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-md shrink-0">
          <span className="text-[11px] text-slate-400">
            {frames.length > 0 ? `필요 원장 ${result.stockCount}개 · 효율 ${result.efficiency}%` : '액자를 담으면 재단이 계산됩니다'}
          </span>
          <button
            onClick={handlePrint}
            disabled={frames.length === 0}
            className="ml-auto inline-flex items-center gap-1.5 h-10 px-6 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition disabled:bg-slate-300"
            title="재단도 + 틀 전개도를 인쇄합니다 (작업자용)"
          >
            <IconPrinter className="w-4 h-4" />
            프린트 출력
          </button>
        </div>
      </div>
    </div>
  );
}
