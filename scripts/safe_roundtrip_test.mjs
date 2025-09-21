import { createClient } from '@supabase/supabase-js';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing env vars VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(2);
  }

  const supabase = createClient(url, key);
  const id = uuidv4();
  const uniqueName = `TEST_ROUNDTRIP_${Date.now()}`;
  const now = new Date().toISOString();

  console.log('Starting safe roundtrip test. Will upsert, read, then delete a scouter with name:', uniqueName);

  // Upsert
  const payload = [{ id, name: uniqueName, alliance: 'red', position: 1, is_remote: false, updated_at: now }];
  const { error: upErr } = await supabase.from('scouters').upsert(payload, { onConflict: 'id' });
  if (upErr) {
    console.error('Upsert failed:', upErr);
    process.exit(1);
  }
  console.log('Upsert succeeded for id', id);

  // Read back
  const { data: fetched, error: qErr } = await supabase.from('scouters').select('*').eq('id', id);
  if (qErr) {
    console.error('Read failed:', qErr);
    process.exit(1);
  }
  console.log('Read back:', fetched && fetched.length ? fetched[0] : 'no-row');

  // Delete
  const { error: delErr } = await supabase.from('scouters').delete().eq('id', id);
  if (delErr) {
    console.error('Delete failed:', delErr);
    process.exit(1);
  }
  console.log('Delete succeeded for id', id);

  console.log('Safe roundtrip test completed successfully. No artifacts left behind.');
  process.exit(0);
}

main();
