import { ScoutingData, Scouter } from '../types';

const STORAGE_KEYS = {
  SCOUTING_DATA: 'frc-scouting-data',
  SCOUTERS: 'frc-scouters',
  MATCHES: 'frc-matches',
  SELECTED_EVENT: 'frc-selected-event',
};

export class DataService {
  static saveScoutingData(data: ScoutingData): void {
    const existingData = this.getScoutingData();
    const updatedData = [...existingData, data];
    localStorage.setItem(STORAGE_KEYS.SCOUTING_DATA, JSON.stringify(updatedData));
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
    // Clear stored matches (queued matches for scouters)
    try {
      localStorage.removeItem(STORAGE_KEYS.MATCHES);
      localStorage.removeItem(STORAGE_KEYS.SELECTED_EVENT);
    } catch {
      // ignore
    }
  }

  static isOnline(): boolean {
    return navigator.onLine;
  }

  static async syncData(): Promise<void> {
    if (!this.isOnline()) return;
    
    // In a real implementation, this would sync with your backend
    console.log('Syncing data with server...');
  }
}