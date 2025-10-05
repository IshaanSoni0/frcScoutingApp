const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
// Read API key from Vite env (build-time) but allow runtime override from localStorage
const BUILD_TBA_API_KEY = (import.meta as any).env?.VITE_TBA_API_KEY || '';
const RUNTIME_TBA_KEY_STORAGE = 'frc-tba-key';

export function getRuntimeTbaKey(): string | null {
  try {
    return localStorage.getItem(RUNTIME_TBA_KEY_STORAGE);
  } catch (e) {
    return null;
  }
}

export function setRuntimeTbaKey(key: string) {
  try {
    localStorage.setItem(RUNTIME_TBA_KEY_STORAGE, key);
  } catch (e) {
    // ignore
  }
}

export function clearRuntimeTbaKey() {
  try { localStorage.removeItem(RUNTIME_TBA_KEY_STORAGE); } catch (e) {}
}

function effectiveTbaKey(): string {
  return getRuntimeTbaKey() || BUILD_TBA_API_KEY || '';
}

export async function fetchEvents(year: number = new Date().getFullYear()) {
  try {
    const key = effectiveTbaKey();
    const response = await fetch(`${TBA_BASE_URL}/events/${year}`, {
      headers: key ? { 'X-TBA-Auth-Key': key } : {},
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch events');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}

export async function fetchEventMatches(eventKey: string) {
  try {
    const key = effectiveTbaKey();
    const response = await fetch(`${TBA_BASE_URL}/event/${eventKey}/matches`, {
      headers: key ? { 'X-TBA-Auth-Key': key } : {},
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch matches');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
}