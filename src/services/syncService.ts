import { DataService } from './dataService';
import { ScoutingData } from '../types';
// Optional supabase client; only used if env vars are set
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  const url = (import.meta as any).env?.VITE_SUPABASE_URL;
  const key = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    supabase = createClient(url, key);
    return supabase;
  }
  return null;
}

async function pushPendingToServer() {
  const pending = DataService.getPendingScouting();
  if (!pending || pending.length === 0) return;

  const all = DataService.getScoutingData() as any[];
  const records = all.filter(r => pending.includes(r.id));

  const client = getSupabaseClient();
  if (!client) {
    // No supabase configured; skip actually sending but keep data pending
    console.log('SyncService: no supabase client configured; pending items remain.');
    return;
  }

  try {
    // upsert into 'scouting_records' table, mapping local shape to server columns
    const payload = records.map(r => ({
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

    const { error } = await client.from('scouting_records').upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('SyncService: failed to upsert', error);
      return;
    }

    // mark as synced locally
    const ids = records.map(r => r.id);
    DataService.markScoutingSynced(ids);
    console.log('SyncService: synced records', ids.length);
  } catch (e) {
    // todo: backoff and retry
    console.error('SyncService error', e);
  }
}

let initialized = false;

export function initializeSyncService() {
  if (initialized) return;
  initialized = true;

  // attempt sync now if online
  if (DataService.isOnline()) {
    pushPendingToServer();
  }

  // when the app comes back online, try to sync
  window.addEventListener('online', () => {
    pushPendingToServer();
  });

  // cross-tab updates: if other tab modified pending queue, react
  window.addEventListener('storage', (e) => {
    if (e.key === 'frc-pending-scouting') {
      // try to sync any new items
      if (DataService.isOnline()) pushPendingToServer();
    }
  });
}

export default {
  initializeSyncService,
  pushPendingToServer,
};
