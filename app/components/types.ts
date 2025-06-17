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
}

export type FilterType = 'completed' | 'deleted' | 'justupload'; 