import { Match, User } from '../types';
import { compareMatches, readableMatchLabel } from '../utils/match';
import { Clock, Users } from 'lucide-react';

interface MatchListProps {
  matches: Match[];
  user: User;
  onMatchSelect: (match: Match) => void;
  onBack?: () => void;
}

export function MatchList({ matches, user, onMatchSelect, onBack }: MatchListProps) {
  const getTeamForUser = (match: Match): string => {
    const alliance = match.alliances[user.alliance];
    const teamKey = alliance.team_keys[user.position - 1];
    return teamKey?.replace('frc', '') || 'Unknown';
  };

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
                <div className="ml-auto">
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
          {matches.slice().sort(compareMatches).map((match) => (
            <div
              key={match.key}
              onClick={() => onMatchSelect(match)}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-blue-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {readableMatchLabel(match)}
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