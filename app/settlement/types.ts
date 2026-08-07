// 월말 정산 체크보드 타입

export type ItemType = '미수' | '미지급';
export type InvoiceStatus = '미발행' | '발행요청' | '발행완료';

export interface SettlementItem {
  id: string;
  month: string;          // 'YYYY-MM'
  item_type: ItemType;
  company: string;
  amount: number;
  biz_no: string | null;
  statement_sent: boolean;
  statement_by: string | null;
  statement_at: string | null;
  invoice_status: InvoiceStatus;
  invoice_by: string | null;
  invoice_at: string | null;
  paid: boolean;
  paid_by: string | null;
  paid_at: string | null;
  memo: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// 엑셀에서 파싱된 (아직 저장 전) 행
export interface ParsedRow {
  itemType: ItemType;
  company: string;
  amount: number;
  bizNo: string;
  statementSent: boolean;   // 엑셀에 이미 적혀있던 '발송완료' 표시
  invoiceStatus: InvoiceStatus; // 엑셀에 이미 적혀있던 'O' 표시
  memo: string;
}

export const WORKER_NAMES = ['박혜경', '김한별', '장석환', '정수원', '이현동', '심민영'];
