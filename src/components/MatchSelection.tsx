import { useState, useEffect } from 'react';
import { Event, Match } from '../types';
import { fetchEvents, fetchEventMatches, getRuntimeTbaKey, setRuntimeTbaKey, clearRuntimeTbaKey } from '../services/tbaApi';
import { DataService } from '../services/dataService';
import { migrateLocalToServer, pushMatchesToServer, deleteMatchesFromServer, fetchServerMatches } from '../services/syncService';
import { ArrowLeft, Calendar, Search, Download } from 'lucide-react';

interface MatchSelectionProps {
  onBack: () => void;
}

export function MatchSelection({ onBack }: MatchSelectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [runtimeKey, setRuntimeKey] = useState<string>('');
  const [serverMatches, setServerMatches] = useState<any[]>([]);
  const [serverLoading, setServerLoading] = useState(false);

  useEffect(() => {
    // Do not auto-load events on mount. User must click 'Check available events' to fetch from TBA.
    try {
      const k = getRuntimeTbaKey();
      if (k) setRuntimeKey(k);
    } catch (e) {}
  }, []);

  const loadMatches = async (eventKey: string) => {
    setLoading(true);
    try {
      // Try to fetch real matches from TBA; fall back to any locally stored matches or an empty list
      const fetched = await fetchEventMatches(eventKey);
      // TBA returns an array of match objects; if empty, it may indicate matches not yet released
      if (Array.isArray(fetched) && fetched.length > 0) {
        setMatches(fetched as Match[]);
        DataService.saveMatches(fetched as any[]);
        DataService.setSelectedEvent(eventKey);
      } else {
        // No matches returned — treat as 'not yet released'
        setMatches([]);
        DataService.setSelectedEvent(eventKey);
      }
    } catch (error) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkAvailableEvents = async () => {
    setLoading(true);
    try {
      const year = new Date().getFullYear();
      const ev = await fetchEvents(year);
      if (Array.isArray(ev) && ev.length > 0) {
        setEvents(ev as Event[]);
      } else {
        // if the fetch returned nothing, keep events empty and show message
        setEvents([]);
      }
    } catch (e) {
      console.error('Failed to fetch events', e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    event.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEventSelect = (eventKey: string) => {
    setSelectedEvent(eventKey);
    loadMatches(eventKey);
  };

  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);

  // Sort matches for display: first by competition level, then by match number, then by key.
  const compLevelRank: Record<string, number> = {
    qm: 1, // qualification
    ef: 2,
    qf: 3,
    sf: 4,
    f: 5,
  };

  function compLevelName(level: string) {
    switch (level) {
      case 'qm': return 'Qualification';
      case 'ef': return 'Eighth-final';
      case 'qf': return 'Quarterfinal';
      case 'sf': return 'Semifinal';
      case 'f': return 'Final';
      default: return level.toUpperCase();
    }
  }

  const sortedMatches = [...matches].sort((a, b) => {
    const ra = compLevelRank[a.comp_level] ?? 99;
    const rb = compLevelRank[b.comp_level] ?? 99;
    if (ra !== rb) return ra - rb;
    if (a.match_number !== b.match_number) return a.match_number - b.match_number;
    return a.key.localeCompare(b.key);
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Admin Panel
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Match Selection</h1>
          </div>
        </div>

        {/* Server queued matches panel */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Queued Matches on Server</h2>
            <div>
              <button
                onClick={async () => {
                  setServerLoading(true);
                  try {
                    const rows = await fetchServerMatches();
                    setServerMatches(rows as any[]);
                  } catch (e) {
                    console.error('Failed to fetch server matches', e);
                    setServerMatches([]);
                  } finally {
                    setServerLoading(false);
                  }
                }}
                className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                {serverLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-3">
            {serverMatches.length === 0 ? (
              <div className="text-gray-500">No queued matches found on server.</div>
            ) : (
              Object.entries(serverMatches.reduce((acc: any, cur: any) => {
                const key = cur.event_key || 'unknown';
                if (!acc[key]) acc[key] = [];
                acc[key].push(cur);
                return acc;
              }, {})).map(([eventKey, rows]: any) => (
                <div key={eventKey} className="border border-gray-100 rounded p-3">
                  <div className="font-medium text-sm text-gray-700 mb-2">Event: {eventKey}</div>
                  <div className="text-sm text-gray-600">
                    {rows.slice(0, 20).map((r: any) => (
                      <div key={r.key} className="flex items-center justify-between py-1">
                        <div>{r.key}</div>
                        <div className="text-xs text-gray-500">{r.match_number}</div>
                      </div>
                    ))}
                    {rows.length > 20 && <div className="text-xs text-gray-400 mt-2">{rows.length - 20} more...</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Events List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">Available Events</h2>
              </div>

              {/* Controls split into two responsive rows: search+check on first line, key controls on second */}
              <div className="mt-3 w-full flex flex-col gap-2">
                <div className="flex items-center gap-2 w-full">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search events..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 h-10 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full"
                    />
                  </div>

                  <button
                    onClick={checkAvailableEvents}
                    disabled={loading}
                    aria-busy={loading}
                    className={`flex items-center gap-2 px-3 rounded-md text-sm transition-colors h-10 flex-shrink-0 ${loading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                  >
                    {loading ? (
                      <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Checking...' : 'Check available events'}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full flex-wrap sm:flex-nowrap sm:justify-end">
                  <input
                    type="password"
                    value={runtimeKey}
                    onChange={(e) => setRuntimeKey(e.target.value)}
                    placeholder="TBA API key"
                    className="px-2 h-10 border border-gray-300 rounded-md text-sm w-full sm:w-64 truncate min-w-0"
                    aria-label="The Blue Alliance API key"
                  />
                  <button
                    onClick={() => { setRuntimeTbaKey(runtimeKey); checkAvailableEvents(); }}
                    className="px-3 h-10 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 whitespace-nowrap flex-shrink-0"
                  >
                    Save & Load
                  </button>
                  <button
                    onClick={() => { clearRuntimeTbaKey(); setRuntimeKey(''); }}
                    className="px-3 h-10 bg-gray-200 text-sm rounded-md hover:bg-gray-300 whitespace-nowrap flex-shrink-0"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading events...</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {filteredEvents.map((event) => (
                  <div
                    key={event.key}
                    onClick={() => handleEventSelect(event.key)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                      selectedEvent === event.key
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <h3 className="font-semibold text-gray-900">{event.name}</h3>
                    <p className="text-sm text-gray-600">{event.key}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.start_date).toLocaleDateString()} - {new Date(event.end_date).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {filteredEvents.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                No events found matching your search.
              </div>
            )}
          </div>

          {/* Matches List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Matches {selectedEvent && `(${matches.length})`}
              </h2>
              <div className="flex items-center gap-2">
                {matches.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                          setSaving(true);
                          setSaveResult(null);
                          try {
                            // attach currently selected event to the matches so they are organized server-side
                            const withEvent = matches.map(m => ({ ...m, event_key: selectedEvent || DataService.getSelectedEvent() }));
                            DataService.saveMatches(withEvent as any[]);
                            // Attempt to push matches directly and report how many were synced
                            const synced = await pushMatchesToServer(withEvent as any[]);
                            // Also run migrateLocalToServer to ensure any pending scouting is pushed
                            const migrateResult = await migrateLocalToServer();
                            setSaveResult(`matches synced: ${synced}; ${migrateResult}`);
                          } catch (e: any) {
                            setSaveResult(String(e?.message || e));
                          } finally {
                            setSaving(false);
                            setTimeout(() => setSaveResult(null), 5000);
                          }
                        }}
                      className={`flex items-center gap-2 ${saving ? 'bg-green-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white px-3 py-2 rounded-md transition-colors text-sm`}
                      disabled={saving}
                    >
                      <Download className="w-4 h-4" />
                      <span>{saving ? 'Saving...' : 'Save Matches'}</span>
                    </button>
                    {saveResult && (
                      <div className="text-sm text-gray-700 ml-2">{saveResult}</div>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setShowConfirmClear(true)}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded-md transition-colors text-sm"
                >
                  Clear queued matches
                </button>
              </div>
            </div>

            {!selectedEvent ? (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Select an event to view matches</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>
                  {loading ? 'Loading matches...' : 'Matches for this event are not yet released by The Blue Alliance.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedMatches.map((match) => (
                  <div key={match.key} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-gray-900">
                        {(() => {
                          // Build a human readable title. If non-qualification comp levels appear,
                          // include them to disambiguate duplicate numbers (e.g., Quarterfinal 1).
                          const lvl = match.comp_level || 'qm';
                          const name = compLevelName(lvl);
                          // Some match objects include a set_number (playoff sets). Show it when present.
                          const setNumber = (match as any).set_number;
                          if (lvl === 'qm') return `${name} ${match.match_number}`;
                          if (setNumber) return `${name} ${setNumber} - Match ${match.match_number}`;
                          return `${name} ${match.match_number}`;
                        })()}
                      </h3>
                      <span className="text-xs text-gray-500">{match.key}</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-red-50 p-2 rounded">
                        <h4 className="font-medium text-red-700 mb-1">Red Alliance</h4>
                        {match.alliances.red.team_keys.map((team, index) => (
                          <div key={team} className="text-red-600">
                            {index + 1}. {team.replace('frc', '')}
                          </div>
                        ))}
                      </div>
                      
                      <div className="bg-blue-50 p-2 rounded">
                        <h4 className="font-medium text-blue-700 mb-1">Blue Alliance</h4>
                        {match.alliances.blue.team_keys.map((team, index) => (
                          <div key={team} className="text-blue-600">
                            {index + 1}. {team.replace('frc', '')}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedEvent && matches.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <p className="text-green-800 font-medium">
                Event selected: {events.find(e => e.key === selectedEvent)?.name}
              </p>
            </div>
            <p className="text-green-700 text-sm mt-1">
              {matches.length} matches loaded and ready for scouting
            </p>
          </div>
        )}
        {deleteError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mt-6">
            <div className="flex items-center justify-between">
              <div className="text-red-800 font-medium">Failed to delete matches from server: {deleteError}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    // retry delete
                    try {
                      setDeleteInProgress(true);
                      const allLocal = DataService.getMatches();
                      const keys = allLocal.map((m: any) => m.key);
                      if (keys.length > 0) await deleteMatchesFromServer(keys);
                      // success: clear local
                      DataService.clearMatches();
                      setMatches([]);
                      setSelectedEvent('');
                      setDeleteError(null);
                    } catch (e: any) {
                      console.error('Retry delete failed:', e);
                      setDeleteError(String(e?.message || e));
                    } finally {
                      setDeleteInProgress(false);
                    }
                  }}
                  disabled={deleteInProgress}
                  className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleteInProgress ? 'Deleting...' : 'Retry delete'}
                </button>
                <button
                  onClick={() => setDeleteError(null)}
                  className="px-3 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        {showConfirmClear && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-sm">
              <h3 className="text-lg font-semibold mb-2">Confirm clear queued matches</h3>
              <p className="text-gray-600 mb-4">Are you sure you want to clear all queued matches for scouters? This cannot be undone.</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="px-3 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
                >
                  No
                </button>
                <button
                  onClick={async () => {
                    try {
                      setDeleteError(null);
                      const allLocal = DataService.getMatches();
                      const keys = allLocal.map((m: any) => m.key);
                      if (keys.length > 0) {
                        await deleteMatchesFromServer(keys);
                      }
                      // clear local matches and selection on success
                      DataService.clearMatches();
                      setMatches([]);
                      setSelectedEvent('');
                      setShowConfirmClear(false);
                    } catch (e: any) {
                      // preserve local matches and surface the error
                      console.error('Failed to delete matches from server:', e);
                      setDeleteError(String(e?.message || e));
                      // keep the modal open so user can retry or cancel
                      // (do not clear local state)
                    }
                  }}
                  className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700"
                >
                  Yes, clear
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Confirmation modal component is implemented inline in the file above via state `showConfirmClear`.