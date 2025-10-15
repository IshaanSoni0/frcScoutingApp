import { useState, useMemo, useEffect } from 'react';
import { ScoutingData } from '../types';
import { DataService } from '../services/dataService';
import { fetchServerScouting, deleteScoutingFromServer } from '../services/syncService';
import { ArrowLeft, BarChart3, Filter, Download } from 'lucide-react';

interface DataAnalysisProps {
  onBack: () => void;
}

export function DataAnalysis({ onBack }: DataAnalysisProps) {
  const [data, setData] = useState<ScoutingData[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    // Try to fetch server data first (so incognito sessions show server rows)
    let mounted = true;
    (async () => {
      setLoadingServer(true);
      try {
        const serverRows: any[] = await fetchServerScouting();
        if (!mounted) return;
        // map server shape to ScoutingData expected by the UI
        const mapped = serverRows.map((r: any) => ({
          id: r.id,
          matchKey: r.match_key,
          teamKey: r.team_key,
          scouter: r.scouter_name,
          alliance: r.alliance,
          position: r.position,
            auto: { ...(r.payload?.auto || { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false }), net: r.payload?.auto?.net ?? false, prosser: r.payload?.auto?.prosser ?? false },
            teleop: { ...(r.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0 }), net: r.payload?.teleop?.net ?? false, prosser: r.payload?.teleop?.prosser ?? false },
          endgame: { ...(r.payload?.endgame || { climb: 'none' }), died: r.payload?.endgame?.died ?? 'none' },
          defense: r.payload?.defense || 'none',
            // algae removed — keep compatibility by ignoring
          timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
        }));
        setData(mapped as ScoutingData[]);
        setServerError(null);
      } catch (e: any) {
        console.error('Failed to fetch server scouting records:', e);
        setServerError(String(e?.message || e));
        // fallback to local data if server request fails
        const local = DataService.getScoutingData();
        setData(local as ScoutingData[]);
      } finally {
        setLoadingServer(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const [filters, setFilters] = useState({
    alliance: 'all',
    team: '',
    sortBy: 'timestamp',
    sortOrder: 'desc' as 'asc' | 'desc',
  });

  const filteredAndSortedData = useMemo(() => {
    let filtered = [...data];

    // Apply filters
    if (filters.alliance !== 'all') {
      filtered = filtered.filter(d => d.alliance === filters.alliance);
    }

    if (filters.team) {
      filtered = filtered.filter(d => 
        d.teamKey.toLowerCase().includes(filters.team.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (filters.sortBy) {
        case 'team':
          aVal = a.teamKey;
          bVal = b.teamKey;
          break;
        case 'totalScore':
          aVal = a.auto.l1 + a.auto.l2 + a.auto.l3 + a.auto.l4 + 
                 a.teleop.l1 + a.teleop.l2 + a.teleop.l3 + a.teleop.l4;
          bVal = b.auto.l1 + b.auto.l2 + b.auto.l3 + b.auto.l4 + 
                 b.teleop.l1 + b.teleop.l2 + b.teleop.l3 + b.teleop.l4;
          break;
        case 'l1Total':
          aVal = a.auto.l1 + a.teleop.l1;
          bVal = b.auto.l1 + b.teleop.l1;
          break;
        default:
          aVal = a.timestamp;
          bVal = b.timestamp;
      }

      if (filters.sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  }, [data, filters]);

  const exportToCSV = () => {
    const headers = [
      'Match', 'Team', 'Scouter', 'Alliance', 'Position',
      'Auto L1', 'Auto L2', 'Auto L3', 'Auto L4', 'Auto Move', 'Auto Net', 'Auto Prosser',
      'Teleop L1', 'Teleop L2', 'Teleop L3', 'Teleop L4', 'Teleop Net', 'Teleop Prosser',
      'Climb', 'Driver Skill', 'Robot Speed', 'Died', 'Defense', 'Timestamp'
    ];

    const rows = filteredAndSortedData.map(d => [
      d.matchKey,
      d.teamKey.replace('frc', ''),
      d.scouter,
      d.alliance,
      d.position,
  d.auto.l1,
  d.auto.l2,
  d.auto.l3,
  d.auto.l4,
  d.auto.hasAuto ? 'Yes' : 'No',
  d.auto.net ? 'Yes' : 'No',
  d.auto.prosser ? 'Yes' : 'No',
    d.teleop.l1,
      d.teleop.l2,
      d.teleop.l3,
      d.teleop.l4,
      d.teleop.net ? 'Yes' : 'No',
      d.teleop.prosser ? 'Yes' : 'No',
      d.endgame.climb,
  d.endgame.driverSkill ?? '',
  d.endgame.robotSpeed ?? '',
  (d.endgame.died === 'none' ? "Didn't die" : d.endgame.died === 'partway' ? 'Died partway' : d.endgame.died === 'start' ? 'Died at start' : ''),
      d.defense,
      new Date(d.timestamp).toLocaleString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frc-scouting-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [showConfirmClearData, setShowConfirmClearData] = useState(false);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleClearData = () => {
    (async () => {
      setDeleteInProgress(true);
      setDeleteError(null);
      try {
        // attempt to delete server-side first
        await deleteScoutingFromServer();
        // then clear local
        DataService.clearScoutingData();
        setData([]);
        setShowConfirmClearData(false);
      } catch (e: any) {
        console.error('Failed to delete scouting data from server:', e);
        setDeleteError(String(e?.message || e));
      } finally {
        setDeleteInProgress(false);
      }
    })();
  };

  const calculateTotalScore = (data: ScoutingData) => {
    const autoTotal = data.auto.l1 + data.auto.l2 + data.auto.l3 + data.auto.l4 + (data.auto.net ? 1 : 0) + (data.auto.prosser ? 1 : 0);
    const teleopTotal = data.teleop.l1 + data.teleop.l2 + data.teleop.l3 + data.teleop.l4 + (data.teleop.net ? 1 : 0) + (data.teleop.prosser ? 1 : 0);
    return autoTotal + teleopTotal;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Admin Panel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={async () => {
                  setLoadingServer(true);
                  try {
                    const serverRows: any[] = await fetchServerScouting();
                    const mapped = serverRows.map((r: any) => ({
                      id: r.id,
                      matchKey: r.match_key,
                      teamKey: r.team_key,
                      scouter: r.scouter_name,
                      alliance: r.alliance,
                      position: r.position,
                      auto: r.payload?.auto || { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false },
                      teleop: r.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0 },
                      endgame: r.payload?.endgame || { climb: 'none' },
                      defense: r.payload?.defense || 'none',
                      algae: r.payload?.algae ?? 0,
                      timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
                    }));
                    setData(mapped as ScoutingData[]);
                    setServerError(null);
                  } catch (e: any) {
                    console.error('Failed to fetch server scouting records:', e);
                    setServerError(String(e?.message || e));
                  } finally {
                    setLoadingServer(false);
                  }
                }}
                className="ml-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                {loadingServer ? 'Refreshing...' : 'Refresh from server'}
              </button>
            </div>
            <button
              onClick={() => setShowConfirmClearData(true)}
              className="ml-3 flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Clear Scouting Data
            </button>

          </div>

          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Data Analysis</h1>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters & Sorting</h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alliance
              </label>
              <select
                value={filters.alliance}
                onChange={(e) => setFilters({ ...filters, alliance: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Alliances</option>
                <option value="red">Red Alliance</option>
                <option value="blue">Blue Alliance</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team Filter
              </label>
              <input
                type="text"
                value={filters.team}
                onChange={(e) => setFilters({ ...filters, team: e.target.value })}
                placeholder="Search by team number"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="timestamp">Date</option>
                <option value="team">Team Number</option>
                <option value="totalScore">Total Score</option>
                <option value="l1Total">L1 Total</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order
              </label>
              <select
                value={filters.sortOrder}
                onChange={(e) => setFilters({ ...filters, sortOrder: e.target.value as 'asc' | 'desc' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {serverError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-800">
              Failed to load server data: {serverError}
            </div>
          )}
          {deleteError && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-800">
              Failed to delete server data: {deleteError}
            </div>
          )}
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Scouting Data ({filteredAndSortedData.length} entries)
          </h2>
          
          {filteredAndSortedData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No scouting data found with current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 font-medium text-gray-900">Team</th>
                    <th className="text-left py-3 font-medium text-gray-900">Alliance</th>
                    <th className="text-left py-3 font-medium text-gray-900">Auto L1-L4</th>
                    <th className="text-left py-3 font-medium text-gray-900">Teleop L1-L4</th>
                    <th className="text-left py-3 font-medium text-gray-900">Auto Net</th>
                    <th className="text-left py-3 font-medium text-gray-900">Auto Prosser</th>
                    <th className="text-left py-3 font-medium text-gray-900">Total</th>
                    <th className="text-left py-3 font-medium text-gray-900">Climb</th>
                    <th className="text-left py-3 font-medium text-gray-900">Driver Skill</th>
                    <th className="text-left py-3 font-medium text-gray-900">Robot Speed</th>
                    <th className="text-left py-3 font-medium text-gray-900">Died</th>
                    <th className="text-left py-3 font-medium text-gray-900">Defense</th>
                    <th className="text-left py-3 font-medium text-gray-900">Teleop Net</th>
                    <th className="text-left py-3 font-medium text-gray-900">Teleop Prosser</th>
                    <th className="text-left py-3 font-medium text-gray-900">Scouter</th>
                    <th className="text-left py-3 font-medium text-gray-900">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedData.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 font-medium text-gray-900">
                        {entry.teamKey.replace('frc', '')}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded text-white ${
                          entry.alliance === 'red' ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {entry.alliance.toUpperCase()} {entry.position}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">
                        {entry.auto.l1}/{entry.auto.l2}/{entry.auto.l3}/{entry.auto.l4}
                      </td>
                      <td className="py-3 text-gray-600">
                        {entry.teleop.l1}/{entry.teleop.l2}/{entry.teleop.l3}/{entry.teleop.l4}
                      </td>
                      <td className="py-3 text-gray-600">{entry.auto.net ? 'Yes' : 'No'}</td>
                      <td className="py-3 text-gray-600">{entry.auto.prosser ? 'Yes' : 'No'}</td>
                      <td className="py-3 font-medium text-gray-900">
                        {calculateTotalScore(entry)}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          entry.endgame.climb === 'deep' ? 'bg-green-100 text-green-800' :
                          entry.endgame.climb === 'low' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.endgame.climb}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">{entry.endgame.driverSkill ?? ''}</td>
                      <td className="py-3 text-gray-600">{entry.endgame.robotSpeed ?? ''}</td>
                      <td className="py-3 text-gray-600">{entry.endgame.died === 'none' ? "Didn't die" : entry.endgame.died === 'partway' ? 'Died partway' : entry.endgame.died === 'start' ? 'Died at start' : ''}</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          entry.defense === 'great' ? 'bg-green-100 text-green-800' :
                          entry.defense === 'ok' ? 'bg-yellow-100 text-yellow-800' :
                          entry.defense === 'bad' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {entry.defense}
                        </span>
                      </td>
                      <td className="py-3 text-gray-600">{entry.teleop.net ? 'Yes' : 'No'}</td>
                      <td className="py-3 text-gray-600">{entry.teleop.prosser ? 'Yes' : 'No'}</td>
                      <td className="py-3 text-gray-600">{entry.scouter}</td>
                      <td className="py-3 text-gray-600">
                        {new Date(entry.timestamp).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {showConfirmClearData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Confirm clear scouting data</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to permanently delete all scouting data? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmClearData(false)}
                className="px-3 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
              >
                No
              </button>
              <button
                onClick={handleClearData}
                disabled={deleteInProgress}
                className="px-3 py-2 rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deleteInProgress ? 'Deleting...' : 'Yes, clear data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}