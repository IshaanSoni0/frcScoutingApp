import { ScoutingData, Scouter } from '../types';
import { uuidv4 } from '../utils/uuid';

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
    localStorage.setItem(STORAGE_KEYS.SCOUTERS, JSON.stringify(scouters));
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
    localStorage.setItem(STORAGE_KEYS.MATCHES, JSON.stringify(matches));
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

  static clearAllPending(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.PENDING_SCOUTING);
    } catch {}
  }

  static async syncData(): Promise<void> {
    // SyncService will orchestrate this; keep for compatibility
    return;
  }
}