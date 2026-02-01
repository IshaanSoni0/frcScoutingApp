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

// NOTE: default to 2025 while new-season events aren't published yet
export async function fetchEvents(year: number = 2025) {
  try {
    const key = effectiveTbaKey();
    // use the /simple endpoint to reduce payload
    const response = await fetch(`${TBA_BASE_URL}/events/${year}/simple`, {
      headers: key ? { 'X-TBA-Auth-Key': key } : {},
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('TBA fetchEvents failed', response.status, text);
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
    // use the /matches/simple endpoint to get compact match objects
    const response = await fetch(`${TBA_BASE_URL}/event/${eventKey}/matches/simple`, {
      headers: key ? { 'X-TBA-Auth-Key': key } : {},
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('TBA fetchEventMatches failed', response.status, text);
      throw new Error('Failed to fetch matches');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching matches:', error);
    return [];
  }
}