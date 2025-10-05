const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
// Read API key from Vite env so builds can inline it when provided at build time
const TBA_API_KEY = (import.meta as any).env?.VITE_TBA_API_KEY || '';

export async function fetchEvents(year: number = new Date().getFullYear()) {
  try {
    const response = await fetch(`${TBA_BASE_URL}/events/${year}`, {
      headers: TBA_API_KEY ? { 'X-TBA-Auth-Key': TBA_API_KEY } : {},
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
    const response = await fetch(`${TBA_BASE_URL}/event/${eventKey}/matches`, {
      headers: TBA_API_KEY ? { 'X-TBA-Auth-Key': TBA_API_KEY } : {},
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