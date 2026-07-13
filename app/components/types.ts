export interface RequestItem {
  id: number;
  company: string;
  program: string;
  pickup_date: string;
  note: string;
  image_url: string | null;
  completed: boolean;
  is_urgent: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string;
  creator: string;
  check_marks?: Annotation[];
  is_work_done?: boolean;  // 작업완료 여부
}

// 출력대기 항목 (NAS 등 공유 폴더의 파일 경로 공유)
export interface FileDrop {
  id: number;
  path: string;
  creator: string | null;
  created_at: string;
  is_urgent?: boolean;      // 긴급 출력 (DB에 is_urgent 컬럼 필요)
  note?: string | null;     // 요청 메모 (DB에 note 컬럼 필요)
  request_id?: number | null; // 연결된 작업 카드 id (DB에 request_id 컬럼 필요)
}

export type FilterType = 'completed' | 'deleted';

export interface CheckMark {
  x: number;
  y: number;
}

// 검수 펜 선 (이미지 기준 % 좌표의 점 배열)
export interface PenPath {
  points: { x: number; y: number }[];
}

// check_marks 컬럼에 함께 저장되는 주석 (핀 | 펜 선)
export type Annotation = CheckMark | PenPath; 