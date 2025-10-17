import { useState, useMemo, useEffect } from 'react';
import { ScoutingData } from '../types';
import { DataService } from '../services/dataService';
import { fetchServerScouting, deleteScoutingFromServer } from '../services/syncService';
import { ArrowLeft, BarChart3, Download } from 'lucide-react';

interface DataAnalysisProps {
  onBack: () => void;
}

type TeamStats = {
  teamKey: string; // frcXXXX
  team: string; // display without frc
  count: number;
  // average number of pieces scored in autonomous per match
  avgAuto: number;
  avgAutoL1: number;
  avgAutoL2: number;
  avgAutoL3: number;
  avgAutoL4: number;
  avgAutoNet: number;
  avgAutoProsser: number;
  // average number of pieces scored in teleop per match
  avgTeleop: number;
  avgTeleopL1: number;
  avgTeleopL2: number;
  avgTeleopL3: number;
  avgTeleopL4: number;
  avgTeleopNet: number;
  avgTeleopProsser: number;
  avgTotalPieces: number; // average total pieces (auto + teleop) per match
};

export function DataAnalysis({ onBack }: DataAnalysisProps) {
  const [rows, setRows] = useState<ScoutingData[]>([]);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingServer(true);
      try {
        const serverRows: any[] = await fetchServerScouting();
        if (!mounted) return;
        const mapped = serverRows.map((r: any) => ({
          id: r.id,
          matchKey: r.match_key,
          teamKey: r.team_key,
          scouter: r.scouter_name,
          alliance: r.alliance,
          position: r.position,
          auto: r.payload?.auto || { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false },
          teleop: r.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0, net: false, prosser: false },
          endgame: r.payload?.endgame || { climb: 'none' },
          defense: r.payload?.defense || 'none',
          timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
        }));
        setRows(mapped as ScoutingData[]);
        setServerError(null);
      } catch (e: any) {
        console.error('Failed to fetch server scouting records:', e);
        setServerError(String(e?.message || e));
        const local = DataService.getScoutingData();
        setRows(local as ScoutingData[]);
      } finally {
        setLoadingServer(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Build list of teams from saved matches (so we include teams with no scouting rows)
  const allTeams = useMemo(() => {
    const matches = DataService.getMatches() || [];
    const teamSet = new Set<string>();
    matches.forEach((m: any) => {
      ['red', 'blue'].forEach((a: any) => {
        (m.alliances?.[a]?.team_keys || []).forEach((tk: string) => teamSet.add(tk));
      });
    });
    if (teamSet.size === 0) {
      rows.forEach(r => teamSet.add(r.teamKey));
    }
    return Array.from(teamSet).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const teamStats = useMemo(() => {
    const byTeam: Record<string, ScoutingData[]> = {};
    rows.forEach(r => {
      byTeam[r.teamKey] = byTeam[r.teamKey] || [];
      byTeam[r.teamKey].push(r);
    });

    const stats: TeamStats[] = allTeams.map((tk) => {
      const entries = byTeam[tk] || [];
      const count = entries.length;
      const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

  const autoL1 = entries.map(e => e.auto.l1 || 0);
  const autoL2 = entries.map(e => e.auto.l2 || 0);
  const autoL3 = entries.map(e => e.auto.l3 || 0);
  const autoL4 = entries.map(e => e.auto.l4 || 0);
  const teleopL1 = entries.map(e => e.teleop.l1 || 0);
  const teleopL2 = entries.map(e => e.teleop.l2 || 0);
  const teleopL3 = entries.map(e => e.teleop.l3 || 0);
  const teleopL4 = entries.map(e => e.teleop.l4 || 0);
  // Treat net/prosser as numeric counts (may be undefined)
  const autoNet = entries.map(e => (e.auto.net ?? 0));
  const autoProsser = entries.map(e => (e.auto.prosser ?? 0));
  const teleopNet = entries.map(e => (e.teleop.net ?? 0));
  const teleopProsser = entries.map(e => (e.teleop.prosser ?? 0));

      const avg = (arr: number[]) => (arr.length === 0 ? 0 : sum(arr) / arr.length);

  const avgAutoL1 = avg(autoL1);
  const avgAutoL2 = avg(autoL2);
  const avgAutoL3 = avg(autoL3);
  const avgAutoL4 = avg(autoL4);
  const avgTeleopL1 = avg(teleopL1);
  const avgTeleopL2 = avg(teleopL2);
  const avgTeleopL3 = avg(teleopL3);
  const avgTeleopL4 = avg(teleopL4);

  // Compute per-entry piece totals and average those. This yields the average number
  // of pieces scored per match in auto/teleop, which is what the user requested.
  const autoPieces = entries.map(e => (e.auto.l1 || 0) + (e.auto.l2 || 0) + (e.auto.l3 || 0) + (e.auto.l4 || 0));
  const teleopPieces = entries.map(e => (e.teleop.l1 || 0) + (e.teleop.l2 || 0) + (e.teleop.l3 || 0) + (e.teleop.l4 || 0));
  const totalPieces = entries.map((_, i) => autoPieces[i] + teleopPieces[i]);

  const avgAuto = avg(autoPieces);
  const avgTeleop = avg(teleopPieces);
  const avgTotal = avg(totalPieces);

  const avgAutoNet = avg(autoNet);
  const avgAutoProsser = avg(autoProsser);
  const avgTeleopNet = avg(teleopNet);
  const avgTeleopProsser = avg(teleopProsser);

      return {
        teamKey: tk,
        team: tk.replace(/^frc/, ''),
        count,
  avgAuto: Math.round(avgAuto * 100) / 100,
        avgAutoL1: Math.round(avgAutoL1 * 100) / 100,
        avgAutoL2: Math.round(avgAutoL2 * 100) / 100,
        avgAutoL3: Math.round(avgAutoL3 * 100) / 100,
        avgAutoL4: Math.round(avgAutoL4 * 100) / 100,
  avgTeleop: Math.round(avgTeleop * 100) / 100,
  avgAutoNet: Math.round(avgAutoNet * 100) / 100,
  avgAutoProsser: Math.round(avgAutoProsser * 100) / 100,
  avgTeleopNet: Math.round(avgTeleopNet * 100) / 100,
  avgTeleopProsser: Math.round(avgTeleopProsser * 100) / 100,
  avgTotalPieces: Math.round(avgTotal * 100) / 100,
        avgTeleopL1: Math.round(avgTeleopL1 * 100) / 100,
        avgTeleopL2: Math.round(avgTeleopL2 * 100) / 100,
        avgTeleopL3: Math.round(avgTeleopL3 * 100) / 100,
        avgTeleopL4: Math.round(avgTeleopL4 * 100) / 100,
        pctTeleopNet,
        pctTeleopProsser,
      } as TeamStats;
    });

    return stats;
  }, [rows, allTeams]);

  const [sortBy, setSortBy] = useState<keyof TeamStats | 'team' | 'count'>('team');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    const copy = [...teamStats];
    copy.sort((a, b) => {
      const aVal: any = (a as any)[sortBy];
      const bVal: any = (b as any)[sortBy];
      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal === bVal) return 0;
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
    return copy;
  }, [teamStats, sortBy, sortOrder]);

  const toggleSort = (key: keyof TeamStats | 'team' | 'count') => {
    if (sortBy === key) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key as any);
      setSortOrder('desc');
    }
  };

  const exportToCSV = () => {
    const headers = ['Team', 'Count', 'Auto L1', 'Auto L2', 'Auto L3', 'Auto L4', 'Auto Avg', 'Auto Net', 'Auto Prosser', 'Teleop L1', 'Teleop L2', 'Teleop L3', 'Teleop L4', 'Teleop Avg', 'Teleop Net', 'Teleop Prosser', 'Total Avg'];
    const rowsCsv = sorted.map(t => [t.team, t.count, t.avgAutoL1, t.avgAutoL2, t.avgAutoL3, t.avgAutoL4, t.avgAuto, t.avgAutoNet, t.avgAutoProsser, t.avgTeleopL1, t.avgTeleopL2, t.avgTeleopL3, t.avgTeleopL4, t.avgTeleop, t.avgTeleopNet, t.avgTeleopProsser, t.avgTotalPieces]);
    const csv = [headers, ...rowsCsv].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `frc-team-stats-${new Date().toISOString().split('T')[0]}.csv`;
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
        await deleteScoutingFromServer();
        DataService.clearScoutingData();
        setRows([]);
        setShowConfirmClearData(false);
      } catch (e: any) {
        console.error('Failed to delete scouting data from server:', e);
        setDeleteError(String(e?.message || e));
      } finally {
        setDeleteInProgress(false);
      }
    })();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded bg-gray-100 hover:bg-gray-200 mr-2">
              <ArrowLeft className="w-4 h-4 text-gray-700" />
            </button>
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Team Analysis</h1>
          </div>
          {serverError && (
            <div className="mt-2 text-red-600">Server: {serverError}</div>
          )}
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
                    teleop: r.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0, net: false, prosser: false },
                    endgame: r.payload?.endgame || { climb: 'none' },
                    defense: r.payload?.defense || 'none',
                    timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
                  }));
                  setRows(mapped as ScoutingData[]);
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
            <button
              onClick={() => setShowConfirmClearData(true)}
              className="ml-2 px-4 py-2 rounded-lg bg-yellow-500 text-white hover:bg-yellow-600"
            >
              Clear Data
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 font-medium text-gray-900">Team</th>
                  <th className="text-left py-3 font-medium text-gray-900">Entries</th>
                  <th onClick={() => toggleSort('avgAutoL1')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Auto L1</th>
                  <th onClick={() => toggleSort('avgAutoL2')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Auto L2</th>
                  <th onClick={() => toggleSort('avgAutoL3')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Auto L3</th>
                  <th onClick={() => toggleSort('avgAutoL4')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Auto L4</th>
                  <th onClick={() => toggleSort('avgTeleopL1')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Teleop L1</th>
                  <th onClick={() => toggleSort('avgTeleopL2')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Teleop L2</th>
                  <th onClick={() => toggleSort('avgTeleopL3')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Teleop L3</th>
                  <th onClick={() => toggleSort('avgTeleopL4')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Teleop L4</th>
                  <th onClick={() => toggleSort('avgAutoNet')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Auto Net</th>
                  <th onClick={() => toggleSort('avgAutoProsser')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Auto Prosser</th>
                  <th onClick={() => toggleSort('avgTeleopNet')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Teleop Net</th>
                  <th onClick={() => toggleSort('avgTeleopProsser')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Teleop Prosser</th>
                  <th onClick={() => toggleSort('avgAuto')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Auto Avg</th>
                  <th onClick={() => toggleSort('avgTeleop')} className="text-left py-3 font-medium text-gray-900 cursor-pointer">Teleop Avg</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.teamKey} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 font-medium text-gray-900">{t.team}</td>
                    <td className="py-3 text-gray-600">{t.count}</td>
                    <td className="py-3 text-gray-600">{t.avgAutoL1.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgAutoL2.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgAutoL3.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgAutoL4.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgTeleopL1.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgTeleopL2.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgTeleopL3.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgTeleopL4.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgAutoNet.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgAutoProsser.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgTeleopNet.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgTeleopProsser.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgAuto.toFixed(2)}</td>
                    <td className="py-3 text-gray-600">{t.avgTeleop.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showConfirmClearData && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">Confirm clear scouting data</h3>
            <p className="text-gray-600 mb-4">Are you sure you want to permanently delete all scouting data? This cannot be undone.</p>
            {deleteError && <p className="text-red-600 mb-2">{deleteError}</p>}
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