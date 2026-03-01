import { ScoutingData, Scouter } from '../types';
import { uuidv4 } from '../utils/uuid';
import { migrateLocalToServer, upsertPitData } from './syncService';

const STORAGE_KEYS = {
  SCOUTING_DATA: 'frc-scouting-data',
  PIT_DATA: 'frc-pit-data',
  PIT_IMAGES: 'frc-pit-images',
  SCOUTERS: 'frc-scouters',
  MATCHES: 'frc-matches',
  SELECTED_EVENT: 'frc-selected-event',
  PENDING_SCOUTING: 'frc-pending-scouting',
  CLIENT_ID: 'frc-client-id',
};

export class DataService {
  // ensure a client id exists for dedup/traceability
  static getClientId(): string {
    let id = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(STORAGE_KEYS.CLIENT_ID, id);
    }
    return id;
  }

  static saveScoutingData(data: ScoutingData): void {
    try {
      const existingData = this.getScoutingData();

      // ensure record has an id and client info
      const record = {
        ...data,
        id: data.id || uuidv4(),
        clientId: (data as any).clientId || this.getClientId(),
        createdAt: (data as any).createdAt || Date.now(),
        synced: false,
      } as any;

      const updatedData = [...existingData, record];
      localStorage.setItem(STORAGE_KEYS.SCOUTING_DATA, JSON.stringify(updatedData));

      // add to pending queue
      const pending = this.getPendingScouting();
      pending.push(record.id);
      localStorage.setItem(STORAGE_KEYS.PENDING_SCOUTING, JSON.stringify(pending));
      // Attempt a background sync when online so saves propagate to server quickly
      try {
        // don't await - fire-and-forget
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.syncData();
      } catch (e) {
        // ignore sync errors here
      }
    } catch (e) {
      // ignore write errors
      // eslint-disable-next-line no-console
      console.error('Failed saving scouting data', e);
    }
  }

  static getScoutingData(): ScoutingData[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCOUTING_DATA);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveScouters(scouters: Scouter[]): void {
    const now = Date.now();
    const stamped = scouters.map(s => ({ ...s, updatedAt: s.updatedAt || now }));
    localStorage.setItem(STORAGE_KEYS.SCOUTERS, JSON.stringify(stamped));
    // notify other listeners in this window (and other tabs via storage event)
    try {
      window.dispatchEvent(new CustomEvent('local-storage', { detail: { key: STORAGE_KEYS.SCOUTERS, value: stamped } }));
    } catch (e) {
      // ignore environments that don't support CustomEvent
    }
  }

  static getScouters(): Scouter[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SCOUTERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveMatches(matches: any[]): void {
    const now = Date.now();
    const stamped = matches.map((m: any) => ({ ...m, updatedAt: m.updatedAt || now }));
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(stamped));
  }

  static getMatches(): any[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MATCHES);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static setSelectedEvent(eventKey: string): void {
    localStorage.setItem(STORAGE_KEYS.SELECTED_EVENT, eventKey);
  }

  static getSelectedEvent(): string | null {
    return localStorage.getItem(STORAGE_KEYS.SELECTED_EVENT);
  }

  static clearMatches(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.MATCHES);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_EVENT);
    } catch {
      // ignore
    }
  }

  // PIT scouting helpers
  static savePitData(teamKey: string, data: any): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PIT_DATA) || '{}';
      const obj = JSON.parse(raw || '{}');
      obj[teamKey] = { ...(obj[teamKey] || {}), ...data, updatedAt: Date.now() };
      localStorage.setItem(STORAGE_KEYS.PIT_DATA, JSON.stringify(obj));
      // attempt to persist to server (fire-and-forget)
      try {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        upsertPitData(teamKey, obj[teamKey]);
      } catch (e) {
        // ignore server errors here
      }
    } catch (e) {
      // ignore
    }
  }

  static getPitData(teamKey?: string): any {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PIT_DATA) || '{}';
      const obj = JSON.parse(raw || '{}');
      if (teamKey) return obj[teamKey] || null;
      return obj;
    } catch (e) {
      return teamKey ? null : {};
    }
  }

  // PIT image helpers - store data URLs (small sets) per team
  static savePitImages(teamKey: string, images: string[]): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PIT_IMAGES) || '{}';
      const obj = JSON.parse(raw || '{}');
      obj[teamKey] = { images: images.slice(), updatedAt: Date.now() };
      localStorage.setItem(STORAGE_KEYS.PIT_IMAGES, JSON.stringify(obj));
      // Note: not uploading images to server here (could be added later)
    } catch (e) {
      // ignore
    }
  }

  static getPitImages(teamKey: string): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PIT_IMAGES) || '{}';
      const obj = JSON.parse(raw || '{}');
      return (obj[teamKey] && obj[teamKey].images) || [];
    } catch (e) {
      return [];
    }
  }

  static deletePitImage(teamKey: string, index: number): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PIT_IMAGES) || '{}';
      const obj = JSON.parse(raw || '{}');
      const arr = (obj[teamKey] && obj[teamKey].images) || [];
      if (index >= 0 && index < arr.length) {
        arr.splice(index, 1);
        obj[teamKey] = { images: arr, updatedAt: Date.now() };
        localStorage.setItem(STORAGE_KEYS.PIT_IMAGES, JSON.stringify(obj));
      }
    } catch (e) {
      // ignore
    }
  }

  static clearScoutingData(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.SCOUTING_DATA);
    } catch {
      // ignore
    }
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }

  // Pending queue helpers
  static getPendingScouting(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PENDING_SCOUTING);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static setPendingScouting(pending: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_SCOUTING, JSON.stringify(pending));
    } catch {
      // ignore
    }
  }

  static markScoutingSynced(ids: string[]): void {
    try {
      const data = this.getScoutingData() as any[];
      const updated = data.map(d => (ids.includes(d.id) ? { ...d, synced: true, syncedAt: Date.now() } : d));
      localStorage.setItem(STORAGE_KEYS.SCOUTING_DATA, JSON.stringify(updated));
      // remove from pending queue
      const pending = this.getPendingScouting().filter(id => !ids.includes(id));
      localStorage.setItem(STORAGE_KEYS.PENDING_SCOUTING, JSON.stringify(pending));
    } catch (e) {
      // ignore
    }
  }

  // Replace the entire scouting data array (used for id-migration fixes)
  static replaceScoutingData(records: any[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SCOUTING_DATA, JSON.stringify(records));
    } catch {
      // ignore
    }
  }

  static updateScoutingData(record: any): void {
    try {
      const data = this.getScoutingData() as any[];
      let found = false;
      const updated = data.map(d => {
        if (d.id === record.id) {
          found = true;
          return { ...d, ...record, synced: false, updatedAt: Date.now() };
        }
        return d;
      });
      if (!found) {
        // insert new local record (server-origin or first-time edit)
        const rec = { ...record, id: record.id || uuidv4(), clientId: record.clientId || this.getClientId(), createdAt: record.createdAt || Date.now(), synced: false, updatedAt: Date.now() };
        updated.push(rec);
      }
      localStorage.setItem(STORAGE_KEYS.SCOUTING_DATA, JSON.stringify(updated));
      // ensure this id is in the pending queue so syncService will push the update
      try {
        const pending = this.getPendingScouting();
        const pid = record.id || (found ? record.id : updated[updated.length - 1].id);
        if (!pending.includes(pid)) {
          pending.push(pid);
          localStorage.setItem(STORAGE_KEYS.PENDING_SCOUTING, JSON.stringify(pending));
          // notify other tabs/listeners
          try {
            window.dispatchEvent(new CustomEvent('local-storage', { detail: { key: STORAGE_KEYS.PENDING_SCOUTING, value: pending } }));
          } catch (e) {
            // ignore
          }
        }
      } catch (e) {
        // ignore pending queue errors
      }
    } catch (e) {
      // ignore
      // eslint-disable-next-line no-console
      console.error('Failed updating scouting data', e);
    }
  }

  static clearAllPending(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.PENDING_SCOUTING);
    } catch {}
  }

  static async syncData(): Promise<void> {
    if (this.isOnline()) {
      await migrateLocalToServer();
    }
  }

  // Migration scaffold: keep a numeric data version in localStorage and apply
  // idempotent migrations when the app loads.
  static async migrateIfNeeded(): Promise<void> {
  const SCHEMA_KEY = 'frc-data-version';
    const vRaw = localStorage.getItem(SCHEMA_KEY);
    const v = vRaw ? Number(vRaw) : 0;
    try {
      if (v < 1) {
        // migration 0 -> 1: convert endgame.climb 'deep' -> 'high'
        const rows = this.getScoutingData();
        const updated = rows.map(r => {
          try {
            const climb = r && r.endgame ? (r.endgame as any).climb : undefined;
            if (climb === 'deep') {
              return { ...r, endgame: { ...(r.endgame || {}), climb: 'high' } };
            }
          } catch (e) {}
          return r;
        });
        this.replaceScoutingData(updated);
        localStorage.setItem(SCHEMA_KEY, '1');
      }

      if (v < 2) {
        // migration 1 -> 2: coerce boolean net/prosser fields to numeric 0/1 and drop legacy auto.prosser
        const rows = this.getScoutingData();
        const updated = rows.map(r => {
          try {
            const auto = r.auto || {};
            const teleop = r.teleop || {};
            const coercedAutoNet = typeof auto.net === 'number' ? auto.net : (auto.net ? 1 : 0);
            const coercedTeleNet = typeof teleop.net === 'number' ? teleop.net : (teleop.net ? 1 : 0);
            const coercedTelePros = typeof teleop.prosser === 'number' ? teleop.prosser : (teleop.prosser ? 1 : 0);
            return { ...r, auto: { ...auto, net: coercedAutoNet }, teleop: { ...teleop, net: coercedTeleNet, prosser: coercedTelePros } };
          } catch (e) { return r; }
        });
        this.replaceScoutingData(updated);
        localStorage.setItem(SCHEMA_KEY, '2');
      }

      // future migrations go here
    } catch (e) {
      // if migration fails, don't block app; leave version as-is for investigation
      // eslint-disable-next-line no-console
      console.error('Migration failed', e);
    }
  }

  // Clean and normalize local data: remove malformed rows, coerce field types,
  // normalize enums, and ensure pending queue references existing records.
  // Returns a summary and the raw backup data (so caller can offer a download).
  static async cleanAndNormalize(): Promise<{ removed: number; fixed: number; pendingRemoved: number; backup: string }> {
    const SCOUT_KEY = STORAGE_KEYS.SCOUTING_DATA;
    const PENDING_KEY = STORAGE_KEYS.PENDING_SCOUTING;
    const raw = localStorage.getItem(SCOUT_KEY) || '[]';
    const pendingRaw = localStorage.getItem(PENDING_KEY) || '[]';
    const backupObj = { scouting: JSON.parse(raw || '[]'), pending: JSON.parse(pendingRaw || '[]') };

    let removed = 0;
    let fixed = 0;
    let pendingRemoved = 0;

    try {
      const rows = backupObj.scouting as any[];
      const cleaned: any[] = [];
      for (const r of rows) {
        // Basic validation: must have id, teamKey, matchKey, scouter
        if (!r || !r.id || !r.teamKey || !r.matchKey || !r.scouter) {
          removed += 1;
          continue;
        }

        let modified = false;
        const out = { ...r } as any;

        // normalize climb
        try {
          const climb = out.endgame?.climb;
          if (climb === 'deep') {
            out.endgame = { ...(out.endgame || {}), climb: 'high' };
            modified = true;
          }
        } catch (e) {}

        // coerce nets/prosser to numbers
        try {
          out.auto = out.auto || {};
          out.teleop = out.teleop || {};
          const autoNet = out.auto.net;
          if (typeof autoNet !== 'number') {
            out.auto.net = autoNet ? 1 : 0;
            modified = true;
          }
          const teleNet = out.teleop.net;
          if (typeof teleNet !== 'number') {
            out.teleop.net = teleNet ? 1 : 0;
            modified = true;
          }
          const telePros = out.teleop.prosser;
          if (typeof telePros !== 'number') {
            out.teleop.prosser = telePros ? 1 : 0;
            modified = true;
          }
        } catch (e) {}

        if (modified) fixed += 1;
        cleaned.push(out);
      }

      // write back cleaned rows
      localStorage.setItem(SCOUT_KEY, JSON.stringify(cleaned));

      // fix pending queue: remove ids that are not in cleaned rows
      try {
        const pending = JSON.parse(pendingRaw || '[]') as string[];
        const validIds = new Set(cleaned.map(r => r.id));
        const newPending = pending.filter(id => {
          const keep = validIds.has(id);
          if (!keep) pendingRemoved += 1;
          return keep;
        });
        localStorage.setItem(PENDING_KEY, JSON.stringify(newPending));
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // if anything goes wrong, preserve original data in localStorage (do not wipe)
      // eslint-disable-next-line no-console
      console.error('cleanAndNormalize failed', e);
      return { removed: 0, fixed: 0, pendingRemoved: 0, backup: JSON.stringify(backupObj) };
    }

    return { removed, fixed, pendingRemoved, backup: JSON.stringify(backupObj) };
  }
}