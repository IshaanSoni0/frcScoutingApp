import { useState, useMemo, useEffect } from 'react';
import { ScoutingData } from '../types';
import { DataService } from '../services/dataService';
import { fetchServerScouting, deleteScoutingFromServer, performFullRefresh } from '../services/syncService';
import { ArrowLeft, BarChart3, Download } from 'lucide-react';

interface DataAnalysisProps {
  onBack: () => void;
}

type TeamStats = {
  teamKey: string; // frcXXXX
  team: string; // display without frc
  count: number;
  // new-scouter metrics
  avgAutoFuel: number; // average autonomous fuel scored
  avgTeleopFuel: number; // average teleop fuel (offence shift total)
  
  // legacy per-shift averages removed; single `avgTeleopFuel` used
  avgClimbedPercent: number; // percent of entries where auto.climbed === true
  matchesPlayed: number; // distinct matches with entries
  matchesScheduled: number; // total matches the team is scheduled to play (from matches list)
  highClimbCount: number; // number of matches where majority reported high climb
  diedCount: number; // number of matches where majority reported died
  avgTotalFuel: number; // average total fuel per match (auto + teleop offence)
  maxClimbLevel: number; // maximum climb level observed (0-3)
  trench: string; // Yes/No/N/A
  shootingAccuracy: string; // descriptive label or N/A
  shootingSpeed: string;
  intakeSpeed: string;
  robotRange: string;
  driverSkill: string; // Low/Medium/High or N/A
  robotSpeed: string; // Slow/Medium/Fast or N/A
  defense: string; // None/Bad/OK/Great or N/A
  avgDefenseTimeSeconds: number; // average defense time in seconds (per-entry defense.duration)
};

export function DataAnalysis({ onBack }: DataAnalysisProps) {
  const formatSeconds = (s: number) => {
    if (!s || s <= 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const [rows, setRows] = useState<ScoutingData[]>([]);
  const [matchesVersion, setMatchesVersion] = useState(0);
  const [loadingServer, setLoadingServer] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState('');
  const [minEntries, setMinEntries] = useState(0);
  const [showAuto, setShowAuto] = useState(true);
  const [showTeleop, setShowTeleop] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoadingServer(true);
      try {
        // Ensure pending local rows are pushed and authoritative server state is pulled
        try {
          await performFullRefresh({ reload: false });
        } catch (e) {
          // if full refresh fails, continue to attempt to fetch server rows
          // eslint-disable-next-line no-console
          console.warn('DataAnalysis: performFullRefresh failed on mount', e);
        }

        const serverRows: any[] = await fetchServerScouting();
        if (!mounted) return;
        const mapped = serverRows.map((r: any) => {
          const rawAuto = r.payload?.auto || {};
          const legacyAutoSum = (rawAuto.l1 || 0) + (rawAuto.l2 || 0) + (rawAuto.l3 || 0) + (rawAuto.l4 || 0) + (typeof rawAuto.net === 'number' ? rawAuto.net : (rawAuto.net ? 1 : 0));
          const autoFuel = typeof rawAuto.fuel === 'number' ? rawAuto.fuel : legacyAutoSum;

          const rawTele = r.payload?.teleop || {};
          const legacyTeleSum = (rawTele.l1 || 0) + (rawTele.l2 || 0) + (rawTele.l3 || 0) + (rawTele.l4 || 0) + (typeof rawTele.net === 'number' ? rawTele.net : (rawTele.net ? 1 : 0)) + (typeof rawTele.prosser === 'number' ? rawTele.prosser : (rawTele.prosser ? 1 : 0));

          return {
            id: r.id,
            matchKey: r.match_key,
            teamKey: r.team_key,
            scouter: r.scouter_name,
            alliance: r.alliance,
            position: r.position,
            auto: {
              fuel: autoFuel,
              neutralZone: !!rawAuto.neutralZone,
              depot: !!rawAuto.depot,
              outpost: !!rawAuto.outpost,
              climbed: !!rawAuto.climbed,
            },
            teleop: {
              offence: {
                fuel: (typeof rawTele.offence?.fuel === 'number') ? rawTele.offence.fuel : legacyTeleSum,
              },
              defense: {
                defense: rawTele.defense?.defense ?? 'na',
                duration: rawTele.defense?.duration ?? 0,
              },
            },
            defense: r.payload?.defense || 'none',
            timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
          } as any;
        });
        setRows(mapped as ScoutingData[]);
        setServerError(null);
      } catch (e: any) {
        console.error('Failed to fetch server scouting records on mount:', e);
        setServerError(String(e?.message || e));
        const local = DataService.getScoutingData();
        setRows(local as ScoutingData[]);
      } finally {
        setLoadingServer(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Listen for server-side updates and local storage changes so components using
  // matches recompute when matches are updated from the server (fixes stale UI on phones)
  useEffect(() => {
    const onServer = () => setMatchesVersion(v => v + 1);
    const onStorage = (e: StorageEvent) => {
      if (!e) return;
      if (e.key === 'frc-matches' || e.key === 'frc-selected-event') setMatchesVersion(v => v + 1);
    };
    window.addEventListener('server-scouting-updated', onServer as EventListener);
    window.addEventListener('storage', onStorage as EventListener);
    return () => {
      window.removeEventListener('server-scouting-updated', onServer as EventListener);
      window.removeEventListener('storage', onStorage as EventListener);
    };
  }, []);

  // auto-refresh when the component mounts (helpful when navigated to from admin panel)
  useEffect(() => {
    // simply call the existing refresh logic by triggering the same fetch flow
    let mounted = true;
    (async () => {
      try {
        try {
          await performFullRefresh({ reload: false });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('DataAnalysis: performFullRefresh failed during auto-refresh', e);
        }
        const serverRows: any[] = await fetchServerScouting();
        if (!mounted) return;
        const mapped = serverRows.map((r: any) => {
          const rawAuto = r.payload?.auto || {};
          const legacyAutoSum = (rawAuto.l1 || 0) + (rawAuto.l2 || 0) + (rawAuto.l3 || 0) + (rawAuto.l4 || 0) + (typeof rawAuto.net === 'number' ? rawAuto.net : (rawAuto.net ? 1 : 0));
          const autoFuel = typeof rawAuto.fuel === 'number' ? rawAuto.fuel : legacyAutoSum;

          const rawTele = r.payload?.teleop || {};
          const legacyTeleSum = (rawTele.l1 || 0) + (rawTele.l2 || 0) + (rawTele.l3 || 0) + (rawTele.l4 || 0) + (typeof rawTele.net === 'number' ? rawTele.net : (rawTele.net ? 1 : 0)) + (typeof rawTele.prosser === 'number' ? rawTele.prosser : (rawTele.prosser ? 1 : 0));

          return {
            id: r.id,
            matchKey: r.match_key,
            teamKey: r.team_key,
            scouter: r.scouter_name,
            alliance: r.alliance,
            position: r.position,
            auto: {
              fuel: autoFuel,
              neutralZone: !!rawAuto.neutralZone,
              depot: !!rawAuto.depot,
              outpost: !!rawAuto.outpost,
              climbed: !!rawAuto.climbed,
            },
                    teleop: {
                      offence: {
                        fuel: (typeof rawTele.offence?.fuel === 'number') ? rawTele.offence.fuel : legacyTeleSum,
                      },
                      defense: {
                        defense: rawTele.defense?.defense ?? 'na',
                        duration: rawTele.defense?.duration ?? 0,
                      },
                    },
            defense: r.payload?.defense || 'none',
            timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
          } as any;
        });
        setRows(mapped as ScoutingData[]);
        setServerError(null);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Build list of teams from saved matches (so we include teams with no scouting rows)
  const allTeams = useMemo(() => {
    const matches = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt);
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
  }, [rows, matchesVersion]);

  const teamStats = useMemo(() => {
    const byTeam: Record<string, ScoutingData[]> = {};
    rows.forEach(r => {
      byTeam[r.teamKey] = byTeam[r.teamKey] || [];
      byTeam[r.teamKey].push(r);
    });

    const matchesList = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt);

    const stats: TeamStats[] = allTeams.map((tk) => {
      const entries = byTeam[tk] || [];
      const count = entries.length;
      // group by match to compute match-level majority decisions
      const byMatch: Record<string, ScoutingData[]> = {};
      entries.forEach(e => {
        byMatch[e.matchKey] = byMatch[e.matchKey] || [];
        byMatch[e.matchKey].push(e);
      });
      const matchKeys = Object.keys(byMatch);
      const matchesPlayed = matchKeys.length;

      // compute how many scheduled matches this team has (from matches list)
      const matchesScheduled = matchesList.filter((m: any) => {
        const keys: string[] = [ ...(m.alliances?.red?.team_keys || []), ...(m.alliances?.blue?.team_keys || []) ];
        return keys.includes(tk);
      }).length;

      // helper for majority: returns true if >=50% of scouters reported the predicate
      const majority = (arr: any[], fn: (v: any) => boolean) => {
        if (arr.length === 0) return false;
        const yes = arr.filter(fn).length;
        return yes / arr.length >= 0.5;
      };

      // endgame-related fields removed; populate default/placeholder values
      let highClimbCount = 0;
      let diedCount = 0;
      const mapDefense = (v: any) => (v === 'none' ? 1 : v === 'bad' ? 2 : v === 'ok' ? 3 : v === 'great' ? 4 : 0);
      const defVals = entries.map(e => mapDefense(e.defense));
      const avgOrNA = (arr: number[]) => {
        const nonZero = arr.filter(v => v > 0);
        if (nonZero.length === 0) return 0;
        return Math.round((nonZero.reduce((s, v) => s + v, 0) / nonZero.length) * 100) / 100;
      };
      const avgDriver = 0;
      const avgSpeed = 0;
      const avgDefense = avgOrNA(defVals);
      const mapBackDriver = (v: number) => 'N/A';
      const mapBackSpeed = (v: number) => 'N/A';
      const mapBackDefense = (v: number) => v <= 1.5 ? 'None/Bad' : v <= 2.5 ? 'OK' : 'Great';
      const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
      const avgShootingAcc = 0;
      const avgShootingSpeed = 0;
      const avgIntakeSpeed = 0;
      const avgRange = 0;
      const trenchVal = 'N/A';
      // New scouter shape: auto.fuel (number), teleop.offence.fuel and teleop.defense.duration
      const autoFuelArr = entries.map(e => (typeof e.auto?.fuel === 'number' ? e.auto.fuel : 0));
      const teleopOffence = entries.map(e => (typeof e.teleop?.offence?.fuel === 'number' ? e.teleop.offence.fuel : 0));

      const avg = (arr: number[]) => (arr.length === 0 ? 0 : sum(arr) / arr.length);

      const avgAutoFuel = avg(autoFuelArr);
      const avgTeleopFuel = avg(teleopOffence);
      const avgTotalFuel = avg(autoFuelArr.map((v, i) => v + teleopOffence[i]));

      // average total defense time per entry (teleop.defense.duration)
      const defenseDurations = entries.map(e => Number((e.teleop as any)?.defense?.duration || 0));
      const avgDefenseTimeSeconds = defenseDurations.length === 0 ? 0 : Math.round((sum(defenseDurations) / defenseDurations.length));

      const climbedArr = entries.map(e => e.auto?.climbed ? 1 : 0);
      const avgClimbedPercent = (climbedArr.length === 0 ? 0 : (sum(climbedArr) / climbedArr.length) * 100);
      const maxClimbLevel = 0;

      return {
        teamKey: tk,
        team: tk.replace(/^frc/, ''),
        count,
          avgAutoFuel: Math.round(avgAutoFuel * 100) / 100,
          avgTeleopFuel: Math.round(avgTeleopFuel * 100) / 100,

          avgTotalFuel: Math.round(avgTotalFuel * 100) / 100,
          avgClimbedPercent: Math.round(avgClimbedPercent * 100) / 100,
          maxClimbLevel,
          avgDefenseTimeSeconds,
          trench: trenchVal,
          shootingAccuracy: 'N/A',
          shootingSpeed: 'N/A',
          intakeSpeed: 'N/A',
          robotRange: 'N/A',
  matchesPlayed,
  matchesScheduled,
        highClimbCount,
        diedCount,
        driverSkill: avgDriver === 0 ? 'N/A' : mapBackDriver(avgDriver),
        robotSpeed: avgSpeed === 0 ? 'N/A' : mapBackSpeed(avgSpeed),
        defense: avgDefense === 0 ? 'N/A' : mapBackDefense(avgDefense),
      } as TeamStats;
    });

    return stats;
  }, [rows, allTeams, matchesVersion]);

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
  }, [teamStats, sortBy, sortOrder, matchesVersion]);

  // apply UI filters
  const filtered = useMemo(() => {
    return sorted.filter(t => {
      const matches = t.team.includes(teamFilter) || t.teamKey.includes(teamFilter) || t.team.toLowerCase().includes(teamFilter.toLowerCase());
      return matches && t.count >= (minEntries || 0);
    });
  }, [sorted, teamFilter, minEntries, matchesVersion]);

  const toggleSort = (key: keyof TeamStats | 'team' | 'count') => {
    if (sortBy === key) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key as any);
      setSortOrder('desc');
    }
  };

  // when user clicks a team, compute per-match averages for that team
  const openTeamDetail = (teamKey: string) => {
    setSelectedTeam(teamKey);
    // group entries by matchKey
    const entries = rows.filter(r => r.teamKey === teamKey);
    const byMatch: Record<string, any[]> = {};
    entries.forEach(e => {
      byMatch[e.matchKey] = byMatch[e.matchKey] || [];
      byMatch[e.matchKey].push(e);
    });
    // also include scheduled matches from the matches list even if no scouters have scouted them yet
    const matchesList = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt);
    const scheduledKeys = new Set<string>();
    matchesList.forEach((m: any) => {
      const keys: string[] = [ ...(m.alliances?.red?.team_keys || []), ...(m.alliances?.blue?.team_keys || []) ];
      if (keys.includes(teamKey)) scheduledKeys.add(m.key);
    });

    const allMatchKeys = Array.from(new Set([ ...Object.keys(byMatch), ...Array.from(scheduledKeys) ]));

    const matches = allMatchKeys.map(mk => {
      const scouterEntries = byMatch[mk];
      if (!scouterEntries || scouterEntries.length === 0) {
        const matchInfo = matchesList.find((m: any) => m.key === mk);
        const matchLabel = matchInfo ? `${matchInfo.comp_level} ${matchInfo.match_number}` : mk;
        return {
          matchKey: mk,
          matchLabel,
          scouterCount: 0,
          notScouted: true,
        } as any;
      }
      
        const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
        const avg = (arr: number[]) => (arr.length === 0 ? 0 : sum(arr) / arr.length);

        // New scouter schema: auto.fuel and teleop.offence.fuel
        const autoFuelArr = scouterEntries.map(e => (typeof e.auto?.fuel === 'number' ? e.auto.fuel : 0));
        const avgAutoFuel = avg(autoFuelArr);

        const teleopOffence = scouterEntries.map(e => (typeof e.teleop?.offence?.fuel === 'number' ? e.teleop.offence.fuel : 0));
        const avgTeleopFirst = 0;
        const avgTeleopSecond = 0;
        const avgTeleopTotal = avg(teleopOffence.map((v, i) => v));
        const avgTotal = avg(autoFuelArr.map((v, i) => v + teleopOffence[i]));

      // endgame removed: use defaults for match-level endgame-derived stats
      const majority = (arr: any[], fn: (v: any) => boolean) => false;
      const isHighClimb = false;
      const isDied = false;
      const mapDefense = (v: any) => (v === 'none' ? 1 : v === 'bad' ? 2 : v === 'ok' ? 3 : v === 'great' ? 4 : 0);
      const avgDriverVal = 0;
      const avgSpeedVal = 0;
      const avgDefVal = avg(scouterEntries.map(e => mapDefense(e.defense)));

      const mapBackDriver = (v: number) => 'N/A';
      const mapBackSpeed = (v: number) => 'N/A';
      const mapBackDefense = (v: number) => v <= 1.5 ? 'None/Bad' : v <= 2.5 ? 'OK' : 'Great';

      const matchInfo = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt).find((m: any) => m.key === mk);
      const matchLabel = matchInfo ? `${matchInfo.comp_level} ${matchInfo.match_number}` : mk;

        return {
        matchKey: mk,
        matchLabel,
        scouterCount: scouterEntries.length,
        avgAutoFuel: Math.round(avgAutoFuel * 100) / 100,
        avgTeleopTotal: Math.round(avgTeleopTotal * 100) / 100,
        avgTotalFuel: Math.round(avgTotal * 100) / 100,
        highClimb: isHighClimb ? 'High' : 'No',
        died: isDied ? 'Yes' : 'No',
        trench: 'N/A',
        shootingAccuracy: 'N/A',
        shootingSpeed: 'N/A',
        intakeSpeed: 'N/A',
        robotRange: 'N/A',
        driverSkill: avgDriverVal === 0 ? 'N/A' : mapBackDriver(avgDriverVal),
        robotSpeed: avgSpeedVal === 0 ? 'N/A' : mapBackSpeed(avgSpeedVal),
        defense: avgDefVal === 0 ? 'N/A' : mapBackDefense(avgDefVal),
      };
    });

    const levelOrder: Record<string, number> = { qm: 1, qf: 2, sf: 3, f: 4, ef: 0, qm_alt: 1 };
    const extractLevelAndNumber = (m: any) => {
      // try to read from label "<comp_level> <match_number>" or fallback to matchKey
      const matchInfo = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt).find((x: any) => x.key === m.matchKey);
      const level = matchInfo?.comp_level || (m.matchLabel ? m.matchLabel.split(' ')[0].toLowerCase() : 'qm');
      const num = matchInfo?.match_number || Number((m.matchLabel || '').split(' ')[1]) || 0;
      return { level: level.toString().toLowerCase(), num: Number(num) };
    };

    setTeamMatches(matches.sort((a, b) => {
      const A = extractLevelAndNumber(a);
      const B = extractLevelAndNumber(b);
      const aRank = levelOrder[A.level] ?? 5;
      const bRank = levelOrder[B.level] ?? 5;
      if (aRank !== bRank) return aRank - bRank;
      return A.num - B.num;
    }));
  };

  const closeTeamDetail = () => {
    setSelectedTeam(null);
    setTeamMatches([]);
  };

  const exportToCSV = () => {
    const headers = ['Team', 'Count'];
    if (showAuto) headers.push('Auto Avg Fuel', 'Auto Climb (max, %)');
    if (showTeleop) headers.push('Teleop Avg Fuel', 'Total Avg Fuel');
    headers.push('Matches Scouted', 'Died (count/matches)', 'Defense');
    const rowsCsv = filtered.map(t => {
      const base: (string|number)[] = [t.team, t.count];
      if (showAuto) base.push(t.avgAutoFuel, `${t.maxClimbLevel}, ${t.avgClimbedPercent.toFixed(1)}%`);
      if (showTeleop) base.push(t.avgTeleopFuel, t.avgTotalFuel);
      base.push(`${t.matchesPlayed}/${t.matchesScheduled}`, `${t.diedCount}/${t.matchesPlayed}`, t.defense);
      return base;
    });
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
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamMatches, setTeamMatches] = useState<any[]>([]);

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

  // summary KPIs
  const totalTeams = teamStats.length;
  const totalEntries = rows.length;

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
                  // perform full clean+sync and then fetch fresh server scouting rows
                  await performFullRefresh({ reload: false });
                  const serverRows: any[] = await fetchServerScouting();
                  const mapped = serverRows.map((r: any) => {
                    const rawAuto = r.payload?.auto || {};
                    const legacyAutoSum = (rawAuto.l1 || 0) + (rawAuto.l2 || 0) + (rawAuto.l3 || 0) + (rawAuto.l4 || 0) + (typeof rawAuto.net === 'number' ? rawAuto.net : (rawAuto.net ? 1 : 0));
                    const autoFuel = typeof rawAuto.fuel === 'number' ? rawAuto.fuel : legacyAutoSum;

                    const rawTele = r.payload?.teleop || {};
                    const legacyTeleSum = (rawTele.l1 || 0) + (rawTele.l2 || 0) + (rawTele.l3 || 0) + (rawTele.l4 || 0) + (typeof rawTele.net === 'number' ? rawTele.net : (rawTele.net ? 1 : 0)) + (typeof rawTele.prosser === 'number' ? rawTele.prosser : (rawTele.prosser ? 1 : 0));

                    return {
                      id: r.id,
                      matchKey: r.match_key,
                      teamKey: r.team_key,
                      scouter: r.scouter_name,
                      alliance: r.alliance,
                      position: r.position,
                      auto: {
                        fuel: autoFuel,
                        neutralZone: !!rawAuto.neutralZone,
                        depot: !!rawAuto.depot,
                        outpost: !!rawAuto.outpost,
                        climbed: !!rawAuto.climbed,
                      },
                      teleop: {
                        offence: {
                          fuel: typeof rawTele.offence?.fuel === 'number' ? rawTele.offence.fuel : legacyTeleSum,
                        },
                        defense: {
                          defense: rawTele.defense?.defense ?? 'na',
                          duration: rawTele.defense?.duration ?? 0,
                        },
                      },
                      defense: r.payload?.defense || 'none',
                      timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
                    } as any;
                  });
                  setRows(mapped as ScoutingData[]);
                  setServerError(null);
                } catch (e: any) {
                  console.error('Failed to refresh server scouting records:', e);
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
          {/* Filter / controls */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <input
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                placeholder="Filter by team (e.g. 254 or frc254)"
                className="px-3 py-2 border rounded-md"
              />
              <input
                type="number"
                value={minEntries}
                onChange={(e) => setMinEntries(Number(e.target.value || 0))}
                className="w-24 px-3 py-2 border rounded-md"
                min={0}
                placeholder="min entries"
                title="Minimum entries to include"
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showAuto} onChange={(e) => setShowAuto(e.target.checked)} />
                Show Auto
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={showTeleop} onChange={(e) => setShowTeleop(e.target.checked)} />
                Show Tele
              </label>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mb-4">
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-500">Teams</div>
              <div className="text-xl font-bold">{totalTeams}</div>
            </div>
            <div className="p-3 border rounded bg-gray-50">
              <div className="text-xs text-gray-500">Entries</div>
              <div className="text-xl font-bold">{totalEntries}</div>
            </div>
          </div>

        
              <div className="overflow-x-auto" style={{ transform: 'rotateX(180deg)' }}>
                <table className="w-full text-sm" style={{ transform: 'rotateX(180deg)' }}>
                  <thead>
                    <tr className="border-b border-gray-300">
                                <th className="text-center py-3 font-medium text-gray-900 px-3">Team</th>
                                <th className="text-center py-3 font-medium text-gray-900 px-3 border-l border-gray-300">Entries</th>
                                <th className="text-center py-3 font-medium text-gray-900 px-3 border-l border-gray-300">Matches Scouted</th>
                                <th onClick={() => toggleSort('avgAutoFuel')} className="text-center py-3 font-medium text-gray-900 cursor-pointer px-3 border-l border-gray-300">Auto Avg Fuel</th>
                                <th onClick={() => toggleSort('avgTeleopFuel')} className="text-center py-3 font-medium text-gray-900 cursor-pointer px-3 border-l border-gray-300">Teleop Avg Fuel</th>
                                {/* Per-shift columns removed */}
                                <th onClick={() => toggleSort('avgTotalFuel')} className="text-center py-3 font-medium text-gray-900 cursor-pointer px-3 border-l border-gray-300">Total Avg Fuel</th>
                                <th onClick={() => toggleSort('avgClimbedPercent')} className="text-center py-3 font-medium text-gray-900 cursor-pointer px-3 border-l border-gray-300">Auto Climb (max, %)</th>
                                <th className="text-center py-3 font-medium text-gray-900 px-3 border-l border-gray-300">Died</th>
                                {/* Removed: Driver Skill, Driving Speed, Trench, Shooting Acc, Shooting Speed, Intake Speed, Robot Range */}
                                <th className="text-center py-3 font-medium text-gray-900 px-3 border-l border-gray-300">Defense</th>
                                <th className="text-center py-3 font-medium text-gray-900 px-3 border-l border-gray-300">Avg Def Time</th>
                    </tr>
                  </thead>
                  <tbody>
                              {sorted.map((t) => (
                      <tr key={t.teamKey} className="border-b border-gray-300 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900 px-3 text-center">
                          <button onClick={() => openTeamDetail(t.teamKey)} className="text-center text-blue-600 hover:underline">
                            {t.team}
                          </button>
                        </td>
                        <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.count}</td>
                        <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.matchesPlayed}/{t.matchesScheduled}</td>
                                  <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.avgAutoFuel.toFixed(2)}</td>
                                  <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.avgTeleopFuel.toFixed(2)}</td>
                                  {/* Per-shift columns removed */}
                                  <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.avgTotalFuel.toFixed(2)}</td>
                                  <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.maxClimbLevel}, {t.avgClimbedPercent.toFixed(1)}%</td>
                        <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.diedCount}/{t.matchesPlayed}</td>
                        {/* Removed: t.driverSkill, t.robotSpeed, t.trench, t.shootingAccuracy, t.shootingSpeed, t.intakeSpeed, t.robotRange */}
                        <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{t.defense}</td>
                        <td className="py-3 text-gray-600 px-3 border-l border-gray-300 text-center">{formatSeconds(t.avgDefenseTimeSeconds)}</td>
                        
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
        </div>
      </div>

        {/* Team detail modal */}
        {selectedTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-7xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Team {selectedTeam.replace(/^frc/, '')} — Match averages</h3>
                <div>
                  <button onClick={closeTeamDetail} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Close</button>
                </div>
              </div>
              <div className="w-full">
                <table className="w-full text-sm table-auto">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-center py-2 align-top px-3">Match</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">Scouters</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">Auto Avg Fuel</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">Teleop Avg Fuel</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">1st Offence Avg</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">2nd Offence Avg</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">Total Avg Fuel</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">High Climb</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">Died</th>
                      <th className="text-center py-2 align-top px-3 border-l border-gray-300">Defense</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMatches.map(m => (
                        m.notScouted ? (
                        <tr key={m.matchKey} className="border-b hover:bg-gray-50 align-top">
                          <td className="py-2 align-top break-words px-3 text-center">{m.matchLabel}</td>
                          <td className="py-2 align-top px-3 border-l border-gray-300" colSpan={10}>
                            <div className="italic text-gray-500 p-3 bg-gray-50 rounded">This match has not been scouted</div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={m.matchKey} className="border-b hover:bg-gray-50 align-top">
                          <td className="py-2 align-top break-words px-3 text-center">{m.matchLabel}</td>
                          <td className="py-2 align-top px-3 border-l border-gray-300 text-center">{m.scouterCount}</td>
                          <td className="py-2 align-top px-3 border-l border-gray-300 text-center">{m.avgAutoFuel.toFixed(2)}</td>
                          <td className="py-2 align-top px-3 border-l border-gray-300 text-center">{m.avgTeleopTotal.toFixed(2)}</td>
                          {/* Per-shift columns removed */}
                          <td className="py-2 align-top px-3 border-l border-gray-300 text-center">{m.avgTotalFuel.toFixed(2)}</td>
                          <td className="py-2 align-top px-3 border-l border-gray-300 text-center">{m.highClimb}</td>
                          <td className="py-2 align-top px-3 border-l border-gray-300 text-center">{m.died}</td>
                          <td className="py-2 align-top px-3 border-l border-gray-300 text-center">{m.defense}</td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

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