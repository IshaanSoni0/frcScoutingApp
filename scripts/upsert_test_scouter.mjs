import { createClient } from '@supabase/supabase-js';

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing env vars');
    process.exit(2);
  }
  const supabase = createClient(url, key);
  const now = new Date().toISOString();
  // simple UUID v4 generator (not cryptographically strong but fine for test)
  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
  const testId = uuidv4();
  const payload = [{ id: testId, name: 'TEST_SERVER_SCOUTER', alliance: 'blue', position: 2, is_remote: false, updated_at: now }];
  const { error } = await supabase.from('scouters').upsert(payload, { onConflict: 'id' });
  if (error) {
    console.error('upsert error', error);
    process.exit(1);
  }
  const { data, error: qErr } = await supabase.from('scouters').select('*').eq('name', 'TEST_SERVER_SCOUTER');
  if (qErr) {
    console.error('query err', qErr);
    process.exit(1);
  }
  console.log('upserted scouter:', data);
}

main();