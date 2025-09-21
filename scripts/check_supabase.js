import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_PROJECT_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

  if (!url || !key) {
    console.error('Missing Supabase env vars. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your shell.');
    process.exit(2);
  }

  const supabase = createClient(url, key);

  try {
    const { data: scouters, error: sErr } = await supabase.from('scouters').select('id', { count: 'exact' });
    if (sErr) {
      console.error('Error selecting scouters:', sErr.message || sErr);
    } else {
      console.log('scouters count:', Array.isArray(scouters) ? scouters.length : (scouters && scouters.length) || 0);
    }
  } catch (e) {
    console.error('Exception querying scouters:', e.message || e);
  }

  try {
    const { data: matches, error: mErr } = await supabase.from('matches').select('key', { count: 'exact' });
    if (mErr) {
      console.error('Error selecting matches:', mErr.message || mErr);
    } else {
      console.log('matches count:', Array.isArray(matches) ? matches.length : (matches && matches.length) || 0);
    }
  } catch (e) {
    console.error('Exception querying matches:', e.message || e);
  }

  process.exit(0);
}

main();