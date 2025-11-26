import { Match, User } from '../types';
import { compareMatches, readableMatchLabel } from '../utils/match';
import { Clock, Users, CheckCircle } from 'lucide-react';
import { DataService } from '../services/dataService';
import { fetchServerScouting, performFullRefresh } from '../services/syncService';
import { useEffect, useState } from 'react';

interface MatchListProps {
  matches: Match[];
  user: User;
  // second arg: optional existing scouting record (local or server) mapped to local shape
  onMatchSelect: (match: Match, existing?: any) => void;
  onBack?: () => void;
}

export function MatchList({ matches, user, onMatchSelect, onBack }: MatchListProps) {
  const getTeamForUser = (match: Match): string => {
    const alliance = match.alliances[user.alliance];
    const teamKey = alliance.team_keys[user.position - 1];
    return teamKey?.replace('frc', '') || 'Unknown';
  };

  const [, setTick] = useState(0);
  const [serverScouting, setServerScouting] = useState<any[]>([]);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e) return;
      if (e.key === 'frc-scouting-data' || e.key === 'frc-pending-scouting' || e.key === 'frc-matches') {
        setTick(t => t + 1);
      }
    };
    const onServer = () => {
      // server-scouting-updated indicates matches/scouters may have changed
      setTick(t => t + 1);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('server-scouting-updated', onServer as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('server-scouting-updated', onServer as EventListener);
    };
  }, []);

  // load server-side scouting records once (manual refresh available)
  useEffect(() => {
    let mounted = true;
    async function loadServerOnce() {
      try {
        const data = await fetchServerScouting();
        if (!mounted) return;
        setServerScouting(Array.isArray(data) ? data : []);
      } catch (e) {
        // ignore fetch errors; we'll fall back to local-only
        // eslint-disable-next-line no-console
        console.warn('MatchList: failed to fetch server scouting', e);
        setServerScouting([]);
      }
    }

    loadServerOnce();
    return () => { mounted = false; };
  }, []);

  const localScouting = DataService.getScoutingData() || [];
  // consider a match scouted for this user if either local or server contains a record
  const isScoutedByUser = (m: Match) => {
    const localHit = localScouting.some((s: any) => s.matchKey === m.key && s.scouter === user.username);
    if (localHit) return true;
    // check server records (match_key / scouter_name)
    const serverHit = serverScouting.some((r: any) => (r.match_key === m.key || r.match_key === m.key) && (r.scouter_name === user.username));
    return !!serverHit;
  };
  const sorted = matches.slice().sort(compareMatches);
  const unscouted = sorted.filter(m => !isScoutedByUser(m));
  const scouted = sorted.filter(m => isScoutedByUser(m));
  const orderedMatches = [...unscouted, ...scouted];

  // match labeling handled by shared helper

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Match Schedule</h1>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {user.username}
            </span>
              {onBack && (
                <div className="ml-auto flex flex-col items-end gap-2">
                  <button
                    onClick={async () => {
                      try {
                        // manual refresh: fetch latest scouting records from server
                        const data = await fetchServerScouting();
                        setServerScouting(Array.isArray(data) ? data : []);
                      } catch (e) {
                        // eslint-disable-next-line no-console
                        console.warn('MatchList: manual refresh failed', e);
                      }
                    }}
                    className="text-sm bg-blue-100 hover:bg-blue-200 px-3 py-1 rounded-md"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={onBack}
                    className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-2 rounded-md"
                  >
                    Logout
                  </button>
                </div>
              )}
            <span className={`px-2 py-1 rounded text-white text-xs font-medium ${
              user.alliance === 'red' ? 'bg-red-500' : 'bg-blue-500'
            }`}>
              {user.alliance.toUpperCase()} {user.position}
            </span>
          </div>
        </div>

        <div className="grid gap-4">
          {orderedMatches.map((match) => (
            <div
              key={match.key}
              onClick={() => {
                // attempt to find existing record for this scouter
                const localScouting = DataService.getScoutingData() || [];
                const local = localScouting.find((s: any) => s.matchKey === match.key && s.scouter === user.username);
                if (local) {
                  onMatchSelect(match, local);
                  return;
                }
                // check server records fetched earlier
                const server = serverScouting.find((r: any) => (r.match_key === match.key || r.match_key === match.key) && r.scouter_name === user.username);
                if (server) {
                  const mapped = {
                    id: server.id,
                    matchKey: server.match_key,
                    teamKey: server.team_key,
                    scouter: server.scouter_name,
                    alliance: server.alliance,
                    position: server.position,
                    auto: {
                      ...(server.payload?.auto || { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false }),
                      net: typeof server.payload?.auto?.net === 'number' ? server.payload.auto.net : (server.payload?.auto?.net ? 1 : 0),
                      prosser: typeof server.payload?.auto?.prosser === 'number' ? server.payload.auto.prosser : (server.payload?.auto?.prosser ? 1 : 0),
                    },
                    teleop: {
                      ...(server.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0 }),
                      net: typeof server.payload?.teleop?.net === 'number' ? server.payload.teleop.net : (server.payload?.teleop?.net ? 1 : 0),
                      prosser: typeof server.payload?.teleop?.prosser === 'number' ? server.payload.teleop.prosser : (server.payload?.teleop?.prosser ? 1 : 0),
                    },
                    endgame: server.payload?.endgame || { climb: 'none' },
                    defense: server.payload?.defense || 'none',
                    timestamp: server.timestamp ? Date.parse(server.timestamp) : Date.now(),
                  };
                  onMatchSelect(match, mapped);
                  return;
                }
                onMatchSelect(match);
              }}
              className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer ${isScoutedByUser(match) ? 'opacity-90 border-l-4 border-green-500' : 'border-l-4 border-blue-500'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <span>{readableMatchLabel(match)}</span>
                    {isScoutedByUser(match) && (
                      <span title="Scouted" className="ml-3 inline-flex items-center">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                      </span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Match {match.match_number}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${user.alliance === 'red' ? 'text-red-600' : 'text-blue-600'}`}>
                    Team {getTeamForUser(match)}
                  </div>
                  <div className="text-sm text-gray-500">Your assignment</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-red-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-red-700 mb-2">Red Alliance</h4>
                  <div className="space-y-1">
                    {match.alliances.red.team_keys.map((teamKey, index) => (
                      <div
                        key={teamKey}
                        className={`text-sm ${
                          user.alliance === 'red' && user.position === index + 1
                            ? 'font-bold text-red-800 bg-red-200 px-2 py-1 rounded'
                            : 'text-red-600'
                        }`}
                      >
                        {index + 1}. {teamKey.replace('frc', '')}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-700 mb-2">Blue Alliance</h4>
                  <div className="space-y-1">
                    {match.alliances.blue.team_keys.map((teamKey, index) => (
                      <div
                        key={teamKey}
                        className={`text-sm ${
                          user.alliance === 'blue' && user.position === index + 1
                            ? 'font-bold text-blue-800 bg-blue-200 px-2 py-1 rounded'
                            : 'text-blue-600'
                        }`}
                      >
                        {index + 1}. {teamKey.replace('frc', '')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {matches.length === 0 && (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No matches available</h3>
            <p className="text-gray-600">Contact your admin to select an event and load matches.</p>
            {onBack && (
              <div className="mt-6">
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}