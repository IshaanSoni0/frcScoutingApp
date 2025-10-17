import { ScoutingData, Scouter } from '../types';
import { uuidv4 } from '../utils/uuid';
import { migrateLocalToServer } from './syncService';

const STORAGE_KEYS = {
  SCOUTING_DATA: 'frc-scouting-data',
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
}