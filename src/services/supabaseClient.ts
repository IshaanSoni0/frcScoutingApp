import { createClient } from '@supabase/supabase-js';

const url = (import.meta as any).env?.VITE_SUPABASE_URL;
const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export function getSupabaseInfo() {
	return {
		url: url || null,
		hasKey: !!key,
		clientPresent: !!supabase,
	};
}

export default supabase;
