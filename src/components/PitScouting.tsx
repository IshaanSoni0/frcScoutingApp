import React, { useMemo, useState } from 'react';
import { DataService } from '../services/dataService';
import { ArrowLeft } from 'lucide-react';

export function PitScouting({ onBack }: { onBack: () => void }) {
  const matches = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt);
  const teams = useMemo(() => {
    const set = new Set<string>();
    matches.forEach((m: any) => {
      ['red', 'blue'].forEach((a) => {
        (m.alliances?.[a]?.team_keys || []).forEach((tk: string) => set.add(tk));
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [matches]);

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);

  if (selectedTeam) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedTeam(null)} className="p-2 rounded bg-gray-100 hover:bg-gray-200">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h1 className="text-xl font-bold">Pit Scouting — Team {selectedTeam.replace(/^frc/, '')}</h1>
            </div>
            <button onClick={onBack} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Back to Matches</button>
          </div>

          <div className="mt-4">
            {/* Blank form placeholder for now */}
            <div className="p-6 border rounded bg-gray-50">
              <div className="text-gray-600">Pit form goes here (blank for now).</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pit Scouting</h1>
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Back to Matches</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {teams.map(t => (
            <button key={t} onClick={() => setSelectedTeam(t)} className="bg-white p-4 rounded shadow hover:shadow-md text-left">
              <div className="text-lg font-semibold">{t.replace(/^frc/, '')}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
