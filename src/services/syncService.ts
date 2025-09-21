import { DataService } from './dataService';
import { ScoutingData } from '../types';
import supabase from './supabaseClient';

function getSupabaseClient() {
  return supabase;
}

// utility: exponential backoff
function wait(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function sendBatchToServer(records: any[]) {
  const client = getSupabaseClient();
  if (!client) throw new Error('no supabase client');

  // try upsert with supabase-js
  const { error } = await client.from('scouting_records').upsert(records, { onConflict: 'id' });
  if (error) throw error;
}

async function pushPendingToServer(options?: { batchSize?: number; maxRetries?: number }) {
  const batchSize = options?.batchSize || 50;
  const maxRetries = options?.maxRetries || 5;

  const pending = DataService.getPendingScouting();
  if (!pending || pending.length === 0) return;

  const all = DataService.getScoutingData() as any[];
  const records = all.filter(r => pending.includes(r.id));
  if (records.length === 0) return;

  const client = getSupabaseClient();
  if (!client) {
    console.log('SyncService: no supabase client configured; pending items remain.');
    return;
  }

  // batch and retry
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    // map to server shape
    const payload = batch.map(r => ({
      id: r.id,
      match_key: r.matchKey,
      team_key: r.teamKey,
      scouter_name: r.scouter,
      alliance: r.alliance,
      position: r.position,
      payload: {
        auto: r.auto,
        teleop: r.teleop,
        endgame: r.endgame,
        defense: r.defense,
      },
      client_id: r.clientId,
      timestamp: new Date(r.timestamp || r.createdAt).toISOString(),
    }));

    let attempt = 0;
    while (attempt <= maxRetries) {
      try {
        await sendBatchToServer(payload);
        const ids = batch.map(r => r.id);
        DataService.markScoutingSynced(ids);
        console.log('SyncService: synced batch', ids.length);
        break;
      } catch (err) {
        attempt++;
        const backoff = Math.pow(2, attempt) * 500; // exponential backoff
        console.warn(`SyncService: batch sync failed, attempt ${attempt}, retrying in ${backoff}ms`, err);
        await wait(backoff);
        if (attempt > maxRetries) {
          console.error('SyncService: max retries reached for batch, leaving pending');
        }
      }
    }
  }
}

// migration: push pending records then pull authoritative scouters & matches
export async function migrateLocalToServer() {
  const client = getSupabaseClient();
  if (!client) {
    console.log('SyncService: migrate skipped (no supabase client)');
    return;
  }

  // 1) push pending scouting
  try {
    await pushPendingToServer({ batchSize: 100, maxRetries: 6 });
  } catch (e) {
    console.error('SyncService: migration push failed', e);
    // continue to attempt pull to get server state
  }

  // 2) pull scouters
  try {
    const { data: scouters, error: sErr } = await client.from('scouters').select('*');
    if (!sErr && scouters) {
      // write into local storage via DataService
      DataService.saveScouters(scouters as any);
    } else if (sErr) {
      console.error('SyncService: failed to pull scouters', sErr);
    }
  } catch (e) {
    console.error('SyncService: error pulling scouters', e);
  }

  // 3) pull matches
  try {
    const { data: matches, error: mErr } = await client.from('matches').select('*');
    if (!mErr && matches) {
      DataService.saveMatches(matches as any);
    } else if (mErr) {
      console.error('SyncService: failed to pull matches', mErr);
    }
  } catch (e) {
    console.error('SyncService: error pulling matches', e);
  }
}

let initialized = false;

export function initializeSyncService() {
  if (initialized) return;
  initialized = true;

  // attempt sync now if online
  if (DataService.isOnline()) {
    // run migration (push local pending, then pull server state)
    migrateLocalToServer().then(() => console.log('SyncService: migration complete'));
  }

  // when the app comes back online, try to sync
  window.addEventListener('online', () => {
    migrateLocalToServer().catch(() => {});
  });

  // cross-tab updates: if other tab modified pending queue, react
  window.addEventListener('storage', (e) => {
    if (e.key === 'frc-pending-scouting') {
      if (DataService.isOnline()) migrateLocalToServer().catch(() => {});
    }
  });

  // periodic background sync: attempt every 60s if online
  setInterval(() => {
    if (DataService.isOnline()) migrateLocalToServer().catch(() => {});
  }, 60_000);
}

export default {
  initializeSyncService,
  pushPendingToServer,
};
