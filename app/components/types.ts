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
  is_just_upload?: boolean;
  created_at: string;
  updated_at?: string;
  creator: string;
  check_marks?: { x: number; y: number }[];
  is_work_done?: boolean;  // 작업완료 여부
}

export type FilterType = 'completed' | 'deleted' | 'justupload';

export interface CheckMark {
  x: number;
  y: number;
} 