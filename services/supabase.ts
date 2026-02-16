import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zsoipveadecrhnpcihay.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzb2lwdmVhZGVjcmhucGNpaGF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjE3NDcsImV4cCI6MjA4NjgzNzc0N30.-6s_hT4JxBgJ2bGzfs2NtAbjRp953d-SojHQ_jFlGws';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);