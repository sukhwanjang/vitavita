import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vubehluedywbykqbdvhs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1YmVobHVlZHl3YnlrcWJkdmhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUyMDIyNTksImV4cCI6MjA2MDc3ODI1OX0.oMgbqco2L6IJGXQdkY0BpLsdde3L2ZKnmNW38-uxN88';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);