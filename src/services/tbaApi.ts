const TBA_BASE_URL = 'https://www.thebluealliance.com/api/v3';
const TBA_API_KEY = 'your-tba-api-key-here'; // Replace with actual API key

export async function fetchEvents(year: number = 2024) {
  try {
    const response = await fetch(`${TBA_BASE_URL}/events/${year}`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY,
      },
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
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY,
      },
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