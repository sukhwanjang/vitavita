import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vubehluedywbykqbdvhs.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1YmVobHVlZHl3YnlrcWJkdmhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ0MDE5MDMsImV4cCI6MjA0OTk3NzkwM30.RxhZ1hNbG2LTSJKaNcLqTpL16PwTqYEq8H7Ox__kF9w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);