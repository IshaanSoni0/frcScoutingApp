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
  try {
    // log summary for debugging
    // eslint-disable-next-line no-console
    console.debug('SyncService: sending batch to scouting_records, count=', records.length);
    const { error, data } = await client.from('scouting_records').upsert(records, { onConflict: 'id' });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('SyncService: upsert error for scouting_records', { error, records });
      throw error;
    }
    // eslint-disable-next-line no-console
    const rows = Array.isArray(data) ? (data as any[]).length : 0;
    console.debug('SyncService: upsert succeeded, rows=', rows);
    return { data };
  } catch (err) {
    // bubble up
    throw err;
  }
}

async function pushPendingToServer(options?: { batchSize?: number; maxRetries?: number }): Promise<number> {
  const batchSize = options?.batchSize || 50;
  const maxRetries = options?.maxRetries || 5;

  const pending = DataService.getPendingScouting();
  if (!pending || pending.length === 0) return 0;

  const all = DataService.getScoutingData() as any[];
  const records = all.filter(r => pending.includes(r.id));
  if (records.length === 0) return 0;

  // Normalize ids: Supabase expects UUIDs for primary keys. If any local record uses a non-UUID id
  // (for example, composed of match/team/timestamp), generate a proper UUID and persist the change
  // so the pending queue and local storage reference the new UUIDs.
  const { uuidv4 } = await import('../utils/uuid');
  let mutated = false;
  const idMap: Record<string, string> = {};
  const newAll = all.map((r: any) => {
    const isUuidLike = typeof r.id === 'string' && r.id.length === 36 && r.id.includes('-');
    if (!isUuidLike) {
      const newId = uuidv4();
      idMap[r.id] = newId;
      mutated = true;
      return { ...r, id: newId };
    }
    return r;
  });
  if (mutated) {
    // persist updated records and update pending queue
    DataService.replaceScoutingData(newAll);
    const newPending = DataService.getPendingScouting().map((pid: string) => idMap[pid] || pid);
    DataService.setPendingScouting(newPending);
    // refresh local pointers
    // eslint-disable-next-line no-console
    console.debug('SyncService: normalized non-UUID ids for pending scouting records', { idMap });
    // recalc records to send
    const refreshedAll = newAll;
    // eslint-disable-next-line no-shadow
    const refreshedRecords = refreshedAll.filter((r: any) => newPending.includes(r.id));
    // override records variable for subsequent processing
    // @ts-ignore
    records.length = 0; // clear
    // @ts-ignore
    records.push(...refreshedRecords);
  }

  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not configured; cannot push pending scouting.');
  }

  // batch and retry
  let totalSynced = 0;
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
        algae: r.algae ?? 0,
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
        totalSynced += ids.length;
        // continue to next batch
        break;
      } catch (err) {
        attempt++;
        const backoff = Math.pow(2, attempt) * 500; // exponential backoff
        console.warn(`SyncService: batch sync failed, attempt ${attempt}, retrying in ${backoff}ms`, err);
        await wait(backoff);
        if (attempt > maxRetries) {
          throw new Error('SyncService: max retries reached for batch, leaving pending');
        }
      }
    }
  }
  return totalSynced;
}
// stray extra brace above removed

// migration: push pending records then pull authoritative scouters & matches
export async function migrateLocalToServer() {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not configured; cannot migrate local data.');
  }

  let pendingSynced = 0;
  let scoutersUpserted = 0;
  let matchesUpserted = 0;

  // 1) push pending scouting
  try {
    pendingSynced = await pushPendingToServer({ batchSize: 100, maxRetries: 6 });
    // continue
  } catch (e) {
    // bubble up push errors — UI may want to display them
    throw e;
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
  // scoutersUpserted is tracked in outer scope
        if (toUpsert.length > 0) {
          try {
            const { error: upErr } = await client.from('scouters').upsert(toUpsert, { onConflict: 'id' });
            if (upErr) {
              console.error('SyncService: error upserting scouters', upErr);
              // persist merged local view
              DataService.saveScouters(merged as any);
              // reflect that merged local view contains these rows
              scoutersUpserted = merged.length;
            } else {
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
                scoutersUpserted = mapped.length;
              } else if (refErr) {
                console.error('SyncService: failed to refresh scouters after upsert', refErr);
                // fallback to merged local state
                DataService.saveScouters(merged as any);
                scoutersUpserted = merged.length;
              }
            }
          } catch (e) {
            console.error('SyncService: exception upserting scouters', e);
            DataService.saveScouters(merged as any);
            scoutersUpserted = merged.length;
          }
        } else {
          // no upserts necessary, persist merged local view
          DataService.saveScouters(merged as any);
          scoutersUpserted = merged.length;
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
    throw e;
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
                matchesUpserted = mapped.length;
              } else if (refErr) {
                console.error('SyncService: failed to refresh matches after upsert', refErr);
                DataService.saveMatches(merged as any);
                matchesUpserted = merged.length;
              }
            }
          } catch (e) {
            console.error('SyncService: exception upserting matches', e);
            DataService.saveMatches(merged as any);
            matchesUpserted = merged.length;
          }
        } else {
          DataService.saveMatches(merged as any);
          matchesUpserted = merged.length;
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
  // return a short status summary for UI consumption
  return `Synced scouting: ${typeof pendingSynced === 'number' ? pendingSynced : 0}; server scouters: ${scoutersUpserted ?? 0}; matches synced: ${matchesUpserted ?? 0}`;
}

// push scouters (array) to server immediately and refresh local storage
export async function pushScoutersToServer(scouters: any[]) {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase client not configured; cannot push scouters.');
  }

  try {
    // ensure ids are UUID-like; generate UUIDs for any non-uuid ids
    const prepared = await Promise.all(scouters.map(async (s: any) => {
      let id = s.id;
      const isUuidLike = typeof id === 'string' && id.length === 36 && id.includes('-');
      if (!isUuidLike) {
        const { uuidv4 } = await import('../utils/uuid');
        id = uuidv4();
      }
      return {
        id,
        name: s.name,
        alliance: s.alliance,
        position: s.position,
        is_remote: s.isRemote ?? false,
        deleted_at: s.deletedAt ? new Date(s.deletedAt).toISOString() : null,
      };
    }));

    const { error } = await client.from('scouters').upsert(prepared, { onConflict: 'id' });
    if (error) {
      // If the error mentions a missing deleted_at column, retry by removing deleted_at
      // but also perform hard deletes for rows that were explicitly deleted locally so the delete persists.
      const message = (error.message || JSON.stringify(error)).toString();
      if (message.toLowerCase().includes('deleted_at') || (error.details && String(error.details).toLowerCase().includes('deleted_at'))) {
        // split prepared into deleted and non-deleted
        const deletedIds: string[] = prepared.filter((p: any) => p.deleted_at).map((p: any) => p.id);
        const preparedNoDeleted = prepared.map((p: any) => {
          const copy: any = { ...p };
          delete copy.deleted_at;
          return copy;
        });

        // First upsert the non-deleted rows (without deleted_at)
        const { error: retryErr } = await client.from('scouters').upsert(preparedNoDeleted, { onConflict: 'id' });
        if (retryErr) {
          throw new Error('pushScoutersToServer: upsert error after retry without deleted_at: ' + (retryErr.message || JSON.stringify(retryErr)));
        }

        // Then, for any rows that were marked deleted locally, attempt hard delete so they are removed from DB
        if (deletedIds.length > 0) {
          try {
            const { error: delErr } = await client.from('scouters').delete().in('id', deletedIds);
            if (delErr) {
              // If delete failed, surface an error so caller knows
              throw new Error('pushScoutersToServer: delete error for removed scouters: ' + (delErr.message || JSON.stringify(delErr)));
            }
          } catch (delEx) {
            // If delete throws, rethrow as a descriptive error
            throw delEx;
          }
        }
      } else {
        throw new Error('pushScoutersToServer: upsert error: ' + message);
      }
    }

    // refresh authoritative rows
    const { data: refreshed, error: refErr } = await client.from('scouters').select('*');
    if (refErr) {
      throw new Error('pushScoutersToServer: failed to refresh scouters: ' + (refErr.message || JSON.stringify(refErr)));
    }

    if (refreshed) {
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
      return `Upserted ${mapped.length} scouters`;
    }
  } catch (e) {
    throw e;
  }
}

export async function fetchServerScouters() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured; cannot fetch scouters.');
  const { data, error } = await client.from('scouters').select('*').order('updated_at', { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
}

// fetch all scouting records from server
export async function fetchServerScouting() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured; cannot fetch scouting records.');

  const { data, error } = await client.from('scouting_records').select('*').order('timestamp', { ascending: false }).limit(1000);
  if (error) throw error;
  return data || [];
}

// delete all scouting records from server
export async function deleteScoutingFromServer() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured; cannot delete scouting records.');
  try {
    // fetch all ids first to avoid comparing uuid to empty string (which causes parse errors)
    const { data: idsData, error: fetchErr } = await client.from('scouting_records').select('id').limit(1000);
    if (fetchErr) throw fetchErr;
    const ids: string[] = Array.isArray(idsData) ? idsData.map((r: any) => r.id).filter(Boolean) : [];
    if (ids.length === 0) return true;

    // delete by id list
    const { error: delErr } = await client.from('scouting_records').delete().in('id', ids);
    if (delErr) throw delErr;
    return true;
  } catch (err) {
    const e: any = err;
    throw new Error('deleteScoutingFromServer: ' + (e?.message || String(e)));
  }
}

// push matches array to server immediately and refresh local storage
export async function pushMatchesToServer(matches: any[]) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured; cannot push matches.');

  try {
    const prepared = matches.map((m: any) => ({
      // include event_key so matches are organized under events in the DB
      event_key: m.event_key || (DataService && DataService.getSelectedEvent && DataService.getSelectedEvent()) || null,
      key: m.key,
      match_number: m.match_number,
      comp_level: m.comp_level,
      alliances: m.alliances,
      deleted_at: m.deletedAt ? new Date(m.deletedAt).toISOString() : null,
    }));

    const { error } = await client.from('matches').upsert(prepared, { onConflict: 'key' });
    if (error) {
      const message = (error.message || JSON.stringify(error)).toString();
      if (message.toLowerCase().includes('deleted_at') || (error.details && String(error.details).toLowerCase().includes('deleted_at'))) {
        // retry without deleted_at and proceed
        const preparedNoDeleted = prepared.map((p: any) => {
          const copy: any = { ...p };
          delete copy.deleted_at;
          return copy;
        });
        const { error: retryErr } = await client.from('matches').upsert(preparedNoDeleted, { onConflict: 'key' });
        if (retryErr) throw retryErr;
      } else {
        throw error;
      }
    }

    // refresh authoritative rows
    const { data: refreshed, error: refErr } = await client.from('matches').select('*');
    if (refErr) throw refErr;
    if (refreshed) {
      const mapped = refreshed.map((m: any) => ({ ...m, updatedAt: m.updated_at ? Date.parse(m.updated_at) : Date.now(), deletedAt: m.deleted_at ? Date.parse(m.deleted_at) : null }));
      DataService.saveMatches(mapped as any);
      return mapped.length;
    }
    return 0;
  } catch (e) {
    throw e;
  }
}

// delete matches by key from server
export async function deleteMatchesFromServer(keys: string[]) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured; cannot delete matches.');

  try {
    const { error } = await client.from('matches').delete().in('key', keys);
    if (error) {
      // bubble up descriptive error
      throw new Error('deleteMatchesFromServer: ' + (error.message || JSON.stringify(error)));
    }
    return true;
  } catch (e) {
    throw e;
  }
}

// fetch matches currently stored on Supabase (optionally limit) and include event_key
export async function fetchServerMatches(limit = 500) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase client not configured; cannot fetch matches.');

  const { data, error } = await client.from('matches').select('*').order('updated_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
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

// Expose debug helpers for manual testing in browser consoles
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  if (typeof window !== 'undefined') {
    // @ts-ignore
    window.syncNow = async () => {
      // eslint-disable-next-line no-console
      console.log('syncNow: triggering migrateLocalToServer()');
      try {
        const res = await migrateLocalToServer();
        // eslint-disable-next-line no-console
        console.log('syncNow: migration finished, result:', res);
        return res;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('syncNow: migration error', e);
        throw e;
      }
    };

    // @ts-ignore
    window.pushPendingToServerNow = async () => {
      // eslint-disable-next-line no-console
      console.log('pushPendingToServerNow: triggering pushPendingToServer()');
      try {
        const res = await pushPendingToServer({ batchSize: 100, maxRetries: 3 });
        // eslint-disable-next-line no-console
        console.log('pushPendingToServerNow: finished, totalSynced=', res);
        return res;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('pushPendingToServerNow: error', e);
        throw e;
      }
    };
  }
} catch (e) {
  // ignore if window isn't available
}
