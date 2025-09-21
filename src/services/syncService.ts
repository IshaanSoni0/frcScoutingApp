import { DataService } from './dataService';
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
      // Merge server scouters with local scouters using last-write-wins merge policy.
      try {
        const local = DataService.getScouters();
        const localMap: Record<string, any> = {};
        local.forEach((s: any) => { if (s && s.id) localMap[s.id] = s; });

        const serverMap: Record<string, any> = {};
        scouters.forEach((s: any) => { if (s && s.id) serverMap[s.id] = s; });

        const allIds = new Set<string>([...Object.keys(localMap), ...Object.keys(serverMap)]);
        const toUpsert: any[] = [];
        const merged: any[] = [];

        for (const id of allIds) {
          const l = localMap[id];
          const s = serverMap[id];

          const serverUpdated = s && s.updated_at ? Date.parse(s.updated_at) : 0;
          const serverDeleted = s && s.deleted_at ? Date.parse(s.deleted_at) : null;
          const serverDeletedTs = serverDeleted ?? 0;
          const localUpdated = l && l.updatedAt ? l.updatedAt : 0;
          const localDeleted = l && l.deletedAt ? l.deletedAt : null;
          const localDeletedTs = localDeleted ?? 0;

          if (s && l) {
            // both exist: compare timestamps
            if (localDeletedTs > 0 && (serverDeletedTs === 0 || localDeletedTs > serverUpdated)) {
              // local has a newer deletion -> push delete to server
              toUpsert.push({
                id,
                name: l.name,
                alliance: l.alliance,
                position: l.position,
                is_remote: l.isRemote ?? false,
                deleted_at: new Date(localDeleted).toISOString(),
              });
              merged.push({ ...l });
            } else if (serverDeletedTs > 0 && (localDeletedTs === 0 || serverDeletedTs > localUpdated)) {
              // server has a newer deletion -> accept server row
              merged.push({
                id: s.id,
                name: s.name,
                alliance: s.alliance,
                position: s.position,
                isRemote: s.is_remote ?? s.isRemote ?? false,
                updatedAt: serverUpdated,
                deletedAt: s.deleted_at ? Date.parse(s.deleted_at) : null,
              });
            } else {
              // no deletion conflict: normal update by updatedAt
              if (localUpdated > serverUpdated) {
                // local wins -> push to server
                toUpsert.push({
                  id,
                  name: l.name,
                  alliance: l.alliance,
                  position: l.position,
                  is_remote: l.isRemote ?? false,
                  deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null,
                });
                merged.push({ ...l });
              } else {
                // server wins -> accept server
                merged.push({
                  id: s.id,
                  name: s.name,
                  alliance: s.alliance,
                  position: s.position,
                  isRemote: s.is_remote ?? s.isRemote ?? false,
                  updatedAt: serverUpdated,
                  deletedAt: s.deleted_at ? Date.parse(s.deleted_at) : null,
                });
              }
            }
          } else if (l && !s) {
            // only local -> create on server
            // ensure id is a valid UUID (Supabase expects uuid primary keys)
            let upsertId = id;
            const isUuidLike = typeof upsertId === 'string' && upsertId.length === 36 && upsertId.includes('-');
            if (!isUuidLike) {
              // generate a UUID and replace the local id so future devices/tabs see the same id
              // dynamic import to avoid circular dependencies
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              const { uuidv4 } = await import('../utils/uuid');
              const newId = uuidv4();
              upsertId = newId;
              // update localMap so merged state includes new id
              const updatedLocal = { ...l, id: newId };
              localMap[newId] = updatedLocal;
              delete localMap[id];
              merged.push({ ...updatedLocal });
              toUpsert.push({
                id: upsertId,
                name: updatedLocal.name,
                alliance: updatedLocal.alliance,
                position: updatedLocal.position,
                is_remote: updatedLocal.isRemote ?? false,
                deleted_at: updatedLocal.deletedAt ? new Date(updatedLocal.deletedAt).toISOString() : null,
              });
              // continue to next id (we've already queued upsert for the replaced item)
              continue;
            }

            toUpsert.push({
              id: upsertId,
              name: l.name,
              alliance: l.alliance,
              position: l.position,
              is_remote: l.isRemote ?? false,
              deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null,
            });
            merged.push({ ...l });
          } else if (s && !l) {
            // only server -> accept server
            merged.push({
              id: s.id,
              name: s.name,
              alliance: s.alliance,
              position: s.position,
              isRemote: s.is_remote ?? s.isRemote ?? false,
              updatedAt: serverUpdated,
              deletedAt: s.deleted_at ? Date.parse(s.deleted_at) : null,
            });
          }
        }

        // If we have upserts to send, push them and then re-pull authoritative server rows
        if (toUpsert.length > 0) {
          try {
            const { error: upErr } = await client.from('scouters').upsert(toUpsert, { onConflict: 'id' });
            if (upErr) console.error('SyncService: error upserting scouters', upErr);
            else {
              // refresh server rows for authoritative timestamps
              const { data: refreshed, error: refErr } = await client.from('scouters').select('*');
              if (!refErr && refreshed) {
                const mapped = refreshed.map((s: any) => ({
                  id: s.id,
                  name: s.name,
                  alliance: s.alliance,
                  position: s.position,
                  isRemote: s.is_remote ?? s.isRemote ?? false,
                  updatedAt: s.updated_at ? Date.parse(s.updated_at) : Date.now(),
                  deletedAt: s.deleted_at ? Date.parse(s.deleted_at) : null,
                }));
                DataService.saveScouters(mapped as any);
              } else if (refErr) {
                console.error('SyncService: failed to refresh scouters after upsert', refErr);
                // fallback to merged local state
                DataService.saveScouters(merged as any);
              }
            }
          } catch (e) {
            console.error('SyncService: exception upserting scouters', e);
            DataService.saveScouters(merged as any);
          }
        } else {
          // no upserts necessary, persist merged local view
          DataService.saveScouters(merged as any);
        }
      } catch (e) {
        console.error('SyncService: error merging scouters', e);
        // as a fallback, write server-provided scouters
        DataService.saveScouters(scouters as any);
      }
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
      // Merge matches by key using last-write-wins on updated_at / updatedAt
      try {
        const local = DataService.getMatches();
        const localMap: Record<string, any> = {};
        local.forEach((m: any) => { if (m && m.key) localMap[m.key] = m; });

        const serverMap: Record<string, any> = {};
        matches.forEach((m: any) => { if (m && m.key) serverMap[m.key] = m; });

        const allKeys = new Set<string>([...Object.keys(localMap), ...Object.keys(serverMap)]);
        const toUpsert: any[] = [];
        const merged: any[] = [];

        for (const key of allKeys) {
          const l = localMap[key];
          const s = serverMap[key];
          const serverUpdated = s && s.updated_at ? Date.parse(s.updated_at) : 0;
          const localUpdated = l && l.updatedAt ? l.updatedAt : 0;

          if (s && l) {
            if (localUpdated > serverUpdated) {
              // local wins -> upsert local
              toUpsert.push({
                key: l.key,
                match_number: l.match_number,
                comp_level: l.comp_level,
                alliances: l.alliances,
                deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null,
              });
              merged.push(l);
            } else {
              // server wins
              merged.push({ ...s, updatedAt: serverUpdated, deletedAt: s.deleted_at ? Date.parse(s.deleted_at) : null });
            }
          } else if (l && !s) {
            toUpsert.push({
              key: l.key,
              match_number: l.match_number,
              comp_level: l.comp_level,
              alliances: l.alliances,
              deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null,
            });
            merged.push(l);
          } else if (s && !l) {
            merged.push({ ...s, updatedAt: serverUpdated, deletedAt: s.deleted_at ? Date.parse(s.deleted_at) : null });
          }
        }

        if (toUpsert.length > 0) {
          try {
            const { error: upErr } = await client.from('matches').upsert(toUpsert, { onConflict: 'key' });
            if (upErr) console.error('SyncService: error upserting matches', upErr);
            else {
              const { data: refreshed, error: refErr } = await client.from('matches').select('*');
              if (!refErr && refreshed) {
                const mapped = refreshed.map((m: any) => ({ ...m, updatedAt: m.updated_at ? Date.parse(m.updated_at) : Date.now(), deletedAt: m.deleted_at ? Date.parse(m.deleted_at) : null }));
                DataService.saveMatches(mapped as any);
              } else if (refErr) {
                console.error('SyncService: failed to refresh matches after upsert', refErr);
                DataService.saveMatches(merged as any);
              }
            }
          } catch (e) {
            console.error('SyncService: exception upserting matches', e);
            DataService.saveMatches(merged as any);
          }
        } else {
          DataService.saveMatches(merged as any);
        }
      } catch (e) {
        console.error('SyncService: error merging matches', e);
        DataService.saveMatches(matches as any);
      }
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
