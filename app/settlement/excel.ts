import * as XLSX from 'xlsx';
import { ItemType, InvoiceStatus, ParsedRow } from './types';

// ── 얼마경리 "미수미지급잔액표" 엑셀 파서 ──────────────────────────
// 형식:
//   보고기간 : 2026-07-01 ~ 2026-07-31          ← 정산 월 자동 인식
//   [미수금(받을돈)] [거래처명] [사업자(주민)번호] (명세표 발송) (계산서 발행) (메모)
//   66,000          (주)니드아이  285-86-00167   발송완료        O
//   ...
// 뒤 3개 열은 직원들이 손으로 적던 표시 — 있으면 상태로 같이 가져온다.
// '미지급금' 헤더가 나오면 그 아래는 미지급 구분으로 읽는다.

export interface ParseResult {
  month: string | null; // 'YYYY-MM' (보고기간에서 인식, 못 찾으면 null)
  rows: ParsedRow[];
}

const asText = (v: unknown) => (v == null ? '' : String(v).trim());

const asNumber = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[,\s원]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// 합계/총계 등 데이터가 아닌 행
const isJunkCompany = (name: string) =>
  !name || /^(합\s*계|총\s*계|소\s*계|계|total)$/i.test(name) || /^[-=\s.]+$/.test(name);

const parseInvoiceMark = (t: string): InvoiceStatus => {
  if (!t) return '미발행';
  if (/요청/.test(t)) return '발행요청';
  if (/^[oO○]$|발행|완료/.test(t)) return '발행완료';
  return '미발행';
};

export async function parseSettlementFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  return parseWorkbook(wb);
}

export function parseWorkbook(wb: XLSX.WorkBook): ParseResult {
  let month: string | null = null;
  const rows: ParsedRow[] = [];

  for (const name of wb.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      defval: null,
      raw: true,
    });

    // 헤더 열 위치 (거래처명 헤더를 만나면 갱신)
    let companyCol = -1;
    let amountCol = -1;
    let bizCol = -1;
    let stmtCol = -1;
    let invCol = -1;
    let memoCol = -1;
    let sectionType: ItemType = '미수';

    for (const raw of grid) {
      const row = raw ?? [];
      const texts = row.map(asText);
      const joined = texts.join(' ');

      // 보고기간에서 월 인식
      if (!month) {
        const m = joined.match(/보고기간\s*:?\s*(\d{4})-(\d{2})/);
        if (m) month = `${m[1]}-${m[2]}`;
      }

      // 헤더 행: '거래처명' 이 들어있는 행
      const cCol = texts.findIndex(t => /거래처명|거래처|업체명/.test(t));
      if (cCol !== -1 && texts.some(t => /미수|미지급|잔액|금액/.test(t))) {
        companyCol = cCol;
        amountCol = texts.findIndex(t => /미수금|미지급금|잔액|금액/.test(t));
        bizCol = texts.findIndex(t => /사업자/.test(t));
        stmtCol = texts.findIndex(t => /명세표/.test(t));
        invCol = texts.findIndex(t => /계산서/.test(t));
        memoCol = texts.findIndex(t => /메모|비고/.test(t));
        sectionType = /미지급/.test(joined) ? '미지급' : '미수';
        continue;
      }

      if (companyCol === -1) continue; // 아직 헤더 전

      const company = asText(row[companyCol]);
      if (isJunkCompany(company)) continue;

      rows.push({
        itemType: sectionType,
        company,
        amount: amountCol >= 0 ? asNumber(row[amountCol]) : 0,
        bizNo: bizCol >= 0 ? asText(row[bizCol]) : '',
        statementSent: stmtCol >= 0 && /발송|완료|[oO○]/.test(asText(row[stmtCol])),
        invoiceStatus: invCol >= 0 ? parseInvoiceMark(asText(row[invCol])) : '미발행',
        memo: memoCol >= 0 ? asText(row[memoCol]) : '',
      });
    }
  }

  return { month, rows };
}

export const formatAmount = (n: number) => n.toLocaleString('ko-KR');

// '8/7 14:32' 형태로 짧게
export const formatWhen = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
