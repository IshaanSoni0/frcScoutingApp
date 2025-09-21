import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export default supabase;
