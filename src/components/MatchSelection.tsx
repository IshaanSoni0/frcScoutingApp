import React, { useState, useEffect } from 'react';
import { Event, Match } from '../types';
import { fetchEvents, fetchEventMatches } from '../services/tbaApi';
import { DataService } from '../services/dataService';
import { ArrowLeft, Calendar, Search, Download } from 'lucide-react';

interface MatchSelectionProps {
  onBack: () => void;
}

export function MatchSelection({ onBack }: MatchSelectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadEvents = async () => {
      setLoading(true);
      try {
        // For demo purposes, using mock data since TBA API requires authentication
        const mockEvents: Event[] = [
          {
            key: '2024demo',
            name: 'Demo Competition 2024',
            start_date: '2024-03-15',
            end_date: '2024-03-17',
          },
          {
            key: '2024regional1',
            name: 'Regional Championship 2024',
            start_date: '2024-04-05',
            end_date: '2024-04-07',
          },
        ];
        setEvents(mockEvents);
      } catch (error) {
        console.error('Error loading events:', error);
      } finally {
        setLoading(false);
      }
    };

    loadEvents();
  }, []);

  const loadMatches = async (eventKey: string) => {
    setLoading(true);
    try {
      // For demo purposes, using mock match data
      const mockMatches: Match[] = [
        {
          key: `${eventKey}_qm1`,
          match_number: 1,
          comp_level: 'qm',
          alliances: {
            red: { team_keys: ['frc1234', 'frc5678', 'frc9012'] },
            blue: { team_keys: ['frc3456', 'frc7890', 'frc2345'] }
          }
        },
        {
          key: `${eventKey}_qm2`,
          match_number: 2,
          comp_level: 'qm',
          alliances: {
            red: { team_keys: ['frc6789', 'frc0123', 'frc4567'] },
            blue: { team_keys: ['frc8901', 'frc2345', 'frc6789'] }
          }
        }
      ];
      setMatches(mockMatches);
      DataService.saveMatches(mockMatches);
      DataService.setSelectedEvent(eventKey);
    } catch (error) {
      console.error('Error loading matches:', error);
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

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Events List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Available Events</h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
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
                  <button
                    onClick={() => DataService.saveMatches(matches)}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md transition-colors text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Save Matches
                  </button>
                )}

                <button
                  onClick={() => {
                    DataService.clearMatches();
                    setMatches([]);
                    setSelectedEvent('');
                  }}
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
                <p>No matches found for selected event</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {matches.map((match) => (
                  <div key={match.key} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-semibold text-gray-900">
                        Qualification {match.match_number}
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
      </div>
    </div>
  );
}