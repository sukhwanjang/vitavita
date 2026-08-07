'use client';
import { useState } from 'react';
import { parseSettlementFile, formatAmount } from './excel';
import { ParsedRow } from './types';

interface UploadModalProps {
  defaultMonth: string; // 'YYYY-MM'
  onClose: () => void;
  onConfirm: (month: string, rows: ParsedRow[]) => Promise<void>;
}

export default function UploadModal({ defaultMonth, onClose, onConfirm }: UploadModalProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [month, setMonth] = useState(defaultMonth);
  const [monthDetected, setMonthDetected] = useState(false);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const misu = rows.filter(r => r.itemType === '미수');
  const mijigeup = rows.filter(r => r.itemType === '미지급');
  const preMarked = rows.filter(r => r.statementSent || r.invoiceStatus !== '미발행').length;

  const handleFile = async (file: File) => {
    setError('');
    try {
      const result = await parseSettlementFile(file);
      if (!result.rows.length) {
        setError('업체를 인식하지 못했습니다. 얼마경리에서 내려받은 미수미지급잔액표 파일이 맞는지 확인해주세요.');
        setRows([]);
        setFileName(file.name);
        return;
      }
      setFileName(file.name);
      setRows(result.rows);
      if (result.month) {
        setMonth(result.month);
        setMonthDetected(true);
      }
    } catch (e) {
      setError(`파일을 읽지 못했습니다: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleSave = async () => {
    if (!rows.length) return;
    setSaving(true);
    try {
      await onConfirm(month, rows);
      onClose();
    } catch (e) {
      setError(`저장 실패: ${e instanceof Error ? e.message : String(e)}`);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">얼마경리 엑셀 업로드</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm">닫기 ✕</button>
        </div>

        {/* 파일 선택 */}
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg py-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-800 transition mb-4">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {fileName ? `📄 ${fileName}` : '클릭해서 미수미지급잔액표 엑셀 선택'}
          </span>
          <span className="text-xs text-slate-400 mt-1">
            {fileName ? '다른 파일을 선택하려면 다시 클릭' : '얼마경리에서 내려받은 .xlsx 파일'}
          </span>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
        </label>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {rows.length > 0 && (
          <>
            {/* 정산 월 */}
            <div className="flex items-end gap-3 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">정산 월</label>
                <input
                  type="month"
                  value={month}
                  onChange={e => { setMonth(e.target.value); setMonthDetected(false); }}
                  className="h-9 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 text-sm text-slate-800 dark:text-slate-200"
                />
              </div>
              {monthDetected && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 pb-2">✓ 보고기간에서 자동 인식됨</span>
              )}
            </div>

            {/* 요약 */}
            <div className="flex flex-wrap gap-2 mb-3 text-sm">
              <span className="px-2.5 py-1 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
                미수 {misu.length}곳 · {formatAmount(misu.reduce((s, r) => s + r.amount, 0))}원
              </span>
              {mijigeup.length > 0 && (
                <span className="px-2.5 py-1 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                  미지급 {mijigeup.length}곳 · {formatAmount(mijigeup.reduce((s, r) => s + r.amount, 0))}원
                </span>
              )}
              {preMarked > 0 && (
                <span className="px-2.5 py-1 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                  엑셀에 적어둔 체크 표시 {preMarked}곳 그대로 가져옴
                </span>
              )}
            </div>

            {/* 미리보기 */}
            <div className="border border-slate-200 dark:border-slate-700 rounded overflow-hidden mb-4">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {rows.slice(0, 120).map((r, i) => (
                      <tr key={i} className="border-t first:border-t-0 border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-1.5 text-slate-800 dark:text-slate-200">{r.company}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {r.amount ? `${formatAmount(r.amount)}원` : '-'}
                        </td>
                        <td className="px-3 py-1.5 text-xs whitespace-nowrap">
                          {r.statementSent && <span className="text-blue-600 dark:text-blue-400 mr-1.5">명세표✓</span>}
                          {r.invoiceStatus === '발행완료' && <span className="text-emerald-600 dark:text-emerald-400">계산서✓</span>}
                          {r.invoiceStatus === '발행요청' && <span className="text-amber-600 dark:text-amber-400">계산서 요청</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 120 && <p className="px-3 py-2 text-xs text-slate-400">… 외 {rows.length - 120}곳</p>}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="h-10 px-4 rounded border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-5 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                {saving ? '저장 중…' : `${month.replace('-', '년 ')}월분 ${rows.length}곳 등록`}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              같은 달에 다시 업로드해도 안전합니다 — 금액·업체만 갱신되고, 사이트에서 이미 체크한 상태는 그대로 유지됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
