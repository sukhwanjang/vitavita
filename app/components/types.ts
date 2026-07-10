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
  check_marks?: { x: number; y: number }[];
  is_work_done?: boolean;  // 작업완료 여부
}

// 파일 대기함 항목 (NAS 등 공유 폴더의 파일 경로 공유)
export interface FileDrop {
  id: number;
  path: string;
  creator: string | null;
  created_at: string;
}

export type FilterType = 'completed' | 'deleted';

export interface CheckMark {
  x: number;
  y: number;
} 