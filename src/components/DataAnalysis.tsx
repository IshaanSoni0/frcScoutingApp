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
  avgAuto: number;
  avgAutoPoints: number;
  avgAutoL1: number;
  avgAutoL2: number;
  avgAutoL3: number;
  avgAutoL4: number;
  avgAutoNet: number;
  avgTeleop: number;
  avgTeleopPoints: number;
  avgTeleopL1: number;
  avgTeleopL2: number;
  avgTeleopL3: number;
  avgTeleopL4: number;
  avgTeleopNet: number; // numeric average for teleop net counts
  avgTeleopProsser: number; // numeric average count
  matchesPlayed: number; // distinct matches with entries
  matchesScheduled: number; // total matches the team is scheduled to play (from matches list)
  highClimbCount: number; // number of matches where majority reported high climb
  diedCount: number; // number of matches where majority reported died
  driverSkill: string; // Low/Medium/High or N/A
  robotSpeed: string; // Slow/Medium/Fast or N/A
  defense: string; // None/Bad/OK/Great or N/A
};

export function DataAnalysis({ onBack }: DataAnalysisProps) {
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
        const serverRows: any[] = await fetchServerScouting();
        if (!mounted) return;
        const mapped = serverRows.map((r: any) => ({
          id: r.id,
          matchKey: r.match_key,
          teamKey: r.team_key,
          scouter: r.scouter_name,
          alliance: r.alliance,
          position: r.position,
          auto: {
            ...(r.payload?.auto || { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false }),
            net: typeof r.payload?.auto?.net === 'number' ? r.payload.auto.net : (r.payload?.auto?.net ? 1 : 0),
            // legacy auto prosser removed - ignore payload auto.prosser
          },
          teleop: {
            ...(r.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0 }),
            net: typeof r.payload?.teleop?.net === 'number' ? r.payload.teleop.net : (r.payload?.teleop?.net ? 1 : 0),
            prosser: typeof r.payload?.teleop?.prosser === 'number' ? r.payload.teleop.prosser : (r.payload?.teleop?.prosser ? 1 : 0),
          },
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
        const serverRows: any[] = await fetchServerScouting();
        if (!mounted) return;
        const mapped = serverRows.map((r: any) => ({
          id: r.id,
          matchKey: r.match_key,
          teamKey: r.team_key,
          scouter: r.scouter_name,
          alliance: r.alliance,
          position: r.position,
          auto: {
            ...(r.payload?.auto || { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false }),
            net: typeof r.payload?.auto?.net === 'number' ? r.payload.auto.net : (r.payload?.auto?.net ? 1 : 0),
            // legacy auto prosser removed - ignore payload auto.prosser
          },
          teleop: {
            ...(r.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0 }),
            net: typeof r.payload?.teleop?.net === 'number' ? r.payload.teleop.net : (r.payload?.teleop?.net ? 1 : 0),
            prosser: typeof r.payload?.teleop?.prosser === 'number' ? r.payload.teleop.prosser : (r.payload?.teleop?.prosser ? 1 : 0),
          },
          endgame: r.payload?.endgame || { climb: 'none' },
          defense: r.payload?.defense || 'none',
          timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
        }));
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

      // per-match majority for high climbs and died
      let highClimbCount = 0;
      let diedCount = 0;
      matchKeys.forEach(mk => {
        const scouters = byMatch[mk];
        const isHigh = majority(scouters, (s) => (s.endgame?.climb === 'high'));
        if (isHigh) highClimbCount += 1;
        const isDied = majority(scouters, (s) => (s.endgame?.died && s.endgame.died !== 'none'));
        if (isDied) diedCount += 1;
      });

      // average mapping helpers for driverSkill, robotSpeed, defense
      const mapDriver = (v: any) => (v === 'low' ? 1 : v === 'medium' ? 2 : v === 'high' ? 3 : 0);
      const mapSpeed = (v: any) => (v === 'slow' ? 1 : v === 'medium' ? 2 : v === 'fast' ? 3 : 0);
      const mapDefense = (v: any) => (v === 'none' ? 1 : v === 'bad' ? 2 : v === 'ok' ? 3 : v === 'great' ? 4 : 0);

      const driverVals = entries.map(e => mapDriver(e.endgame?.driverSkill));
      const speedVals = entries.map(e => mapSpeed(e.endgame?.robotSpeed));
      const defVals = entries.map(e => mapDefense(e.defense));

      const avgOrNA = (arr: number[]) => {
        const nonZero = arr.filter(v => v > 0);
        if (nonZero.length === 0) return 0;
        return Math.round((nonZero.reduce((s, v) => s + v, 0) / nonZero.length) * 100) / 100;
      };

      const avgDriver = avgOrNA(driverVals);
      const avgSpeed = avgOrNA(speedVals);
      const avgDefense = avgOrNA(defVals);

      const mapBackDriver = (v: number) => v <= 1.5 ? 'Low' : v <= 2.5 ? 'Medium' : 'High';
      const mapBackSpeed = (v: number) => v <= 1.5 ? 'Slow' : v <= 2.5 ? 'Medium' : 'Fast';
      const mapBackDefense = (v: number) => v <= 1.5 ? 'None/Bad' : v <= 2.5 ? 'OK' : 'Great';
      const sum = (arr: number[]) => arr.reduce((s, v) => s + v, 0);

      const autoL1 = entries.map(e => e.auto.l1 || 0);
      const autoL2 = entries.map(e => e.auto.l2 || 0);
      const autoL3 = entries.map(e => e.auto.l3 || 0);
      const autoL4 = entries.map(e => e.auto.l4 || 0);
      const teleopL1 = entries.map(e => e.teleop.l1 || 0);
      const teleopL2 = entries.map(e => e.teleop.l2 || 0);
      const teleopL3 = entries.map(e => e.teleop.l3 || 0);
      const teleopL4 = entries.map(e => e.teleop.l4 || 0);
    const teleopNet = entries.map(e => e.teleop.net ? 1 : 0);
  const teleopProsser = entries.map(e => (typeof e.teleop.prosser === 'number' ? e.teleop.prosser : (e.teleop.prosser ? 1 : 0)));
  const autoNet = entries.map(e => (typeof e.auto.net === 'number' ? e.auto.net : (e.auto.net ? 1 : 0)));

      const avg = (arr: number[]) => (arr.length === 0 ? 0 : sum(arr) / arr.length);

      const avgAutoL1 = avg(autoL1);
      const avgAutoL2 = avg(autoL2);
      const avgAutoL3 = avg(autoL3);
      const avgAutoL4 = avg(autoL4);
      const avgTeleopL1 = avg(teleopL1);
      const avgTeleopL2 = avg(teleopL2);
      const avgTeleopL3 = avg(teleopL3);
      const avgTeleopL4 = avg(teleopL4);

  const avgAutoNet = avg(autoNet);
    // compute per-entry total pieces for auto (L1-L4 + net + prosser) and average those totals
    const autoTotals = entries.map(e => {
      const l1 = e.auto.l1 || 0;
      const l2 = e.auto.l2 || 0;
      const l3 = e.auto.l3 || 0;
      const l4 = e.auto.l4 || 0;
      const netVal = (typeof e.auto.net === 'number' ? e.auto.net : (e.auto.net ? 1 : 0));
      return l1 + l2 + l3 + l4 + netVal; // prosser removed from auto totals
    });
    const avgAuto = avg(autoTotals);

    // compute average auto points per entry using scoring rules:
    // auto: l1=3, l2=4, l3=6, l4=7, net=4
    const autoPointsPerEntry = entries.map(e => {
      const l1 = e.auto.l1 || 0;
      const l2 = e.auto.l2 || 0;
      const l3 = e.auto.l3 || 0;
      const l4 = e.auto.l4 || 0;
      const netVal = (typeof e.auto.net === 'number' ? e.auto.net : (e.auto.net ? 1 : 0));
      return l1 * 3 + l2 * 4 + l3 * 6 + l4 * 7 + netVal * 4;
    });
    const avgAutoPoints = avg(autoPointsPerEntry);

  const avgTeleopProsser = avg(teleopProsser);
    const avgTeleopNet = avg(teleopNet);
    // compute per-entry total pieces for teleop (L1-L4 + net + prosser) and average those totals
    const teleopTotals = entries.map(e => {
      const l1 = e.teleop.l1 || 0;
      const l2 = e.teleop.l2 || 0;
      const l3 = e.teleop.l3 || 0;
      const l4 = e.teleop.l4 || 0;
      const netVal = (typeof e.teleop.net === 'number' ? e.teleop.net : (e.teleop.net ? 1 : 0));
      const prosVal = (typeof e.teleop.prosser === 'number' ? e.teleop.prosser : (e.teleop.prosser ? 1 : 0));
      return l1 + l2 + l3 + l4 + netVal + prosVal;
    });
    const avgTeleop = avg(teleopTotals);

    // compute average teleop points per entry using scoring rules:
    // teleop: l1=2, l2=3, l3=4, l4=5, prosser=6, net=4
    const teleopPointsPerEntry = entries.map(e => {
      const l1 = e.teleop.l1 || 0;
      const l2 = e.teleop.l2 || 0;
      const l3 = e.teleop.l3 || 0;
      const l4 = e.teleop.l4 || 0;
      const netVal = (typeof e.teleop.net === 'number' ? e.teleop.net : (e.teleop.net ? 1 : 0));
      const prosVal = (typeof e.teleop.prosser === 'number' ? e.teleop.prosser : (e.teleop.prosser ? 1 : 0));
      return l1 * 2 + l2 * 3 + l3 * 4 + l4 * 5 + prosVal * 6 + netVal * 4;
    });
    const avgTeleopPoints = avg(teleopPointsPerEntry);

      return {
        teamKey: tk,
        team: tk.replace(/^frc/, ''),
        count,
        avgAuto: Math.round(avgAuto * 100) / 100,
        avgAutoPoints: Math.round(avgAutoPoints * 100) / 100,
        avgAutoL1: Math.round(avgAutoL1 * 100) / 100,
        avgAutoL2: Math.round(avgAutoL2 * 100) / 100,
        avgAutoL3: Math.round(avgAutoL3 * 100) / 100,
        avgAutoL4: Math.round(avgAutoL4 * 100) / 100,
  avgAutoNet: Math.round(avgAutoNet * 100) / 100,
        avgTeleop: Math.round(avgTeleop * 100) / 100,
  avgTeleopPoints: Math.round(avgTeleopPoints * 100) / 100,
        avgTeleopL1: Math.round(avgTeleopL1 * 100) / 100,
        avgTeleopL2: Math.round(avgTeleopL2 * 100) / 100,
        avgTeleopL3: Math.round(avgTeleopL3 * 100) / 100,
        avgTeleopL4: Math.round(avgTeleopL4 * 100) / 100,
        avgTeleopNet: Math.round(avgTeleopNet * 100) / 100,
        avgTeleopProsser: Math.round(avgTeleopProsser * 100) / 100,
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

      const autoL1 = scouterEntries.map(e => e.auto.l1 || 0);
      const autoL2 = scouterEntries.map(e => e.auto.l2 || 0);
      const autoL3 = scouterEntries.map(e => e.auto.l3 || 0);
      const autoL4 = scouterEntries.map(e => e.auto.l4 || 0);
      const autoNet = scouterEntries.map(e => (typeof e.auto.net === 'number' ? e.auto.net : (e.auto.net ? 1 : 0)));
      const autoPros = scouterEntries.map(e => (typeof e.auto.prosser === 'number' ? e.auto.prosser : (e.auto.prosser ? 1 : 0)));

      const teleopL1 = scouterEntries.map(e => e.teleop.l1 || 0);
      const teleopL2 = scouterEntries.map(e => e.teleop.l2 || 0);
      const teleopL3 = scouterEntries.map(e => e.teleop.l3 || 0);
      const teleopL4 = scouterEntries.map(e => e.teleop.l4 || 0);
      const teleopNet = scouterEntries.map(e => (typeof e.teleop.net === 'number' ? e.teleop.net : (e.teleop.net ? 1 : 0)));
      const teleopPros = scouterEntries.map(e => (typeof e.teleop.prosser === 'number' ? e.teleop.prosser : (e.teleop.prosser ? 1 : 0)));

      const avgAutoL1 = avg(autoL1);
      const avgAutoL2 = avg(autoL2);
      const avgAutoL3 = avg(autoL3);
      const avgAutoL4 = avg(autoL4);
  const avgAutoNet = avg(autoNet);
  const avgAutoPros = avg(autoPros);
  const avgAutoTotal = avg(scouterEntries.map(e => (e.auto.l1 || 0) + (e.auto.l2 || 0) + (e.auto.l3 || 0) + (e.auto.l4 || 0) + (typeof e.auto.net === 'number' ? e.auto.net : (e.auto.net ? 1 : 0))));

      const avgTeleopL1 = avg(teleopL1);
      const avgTeleopL2 = avg(teleopL2);
      const avgTeleopL3 = avg(teleopL3);
      const avgTeleopL4 = avg(teleopL4);
      const avgTeleopNet = avg(teleopNet);
      const avgTeleopPros = avg(teleopPros);
      const avgTeleopTotal = avg(scouterEntries.map(e => (e.teleop.l1 || 0) + (e.teleop.l2 || 0) + (e.teleop.l3 || 0) + (e.teleop.l4 || 0) + (typeof e.teleop.net === 'number' ? e.teleop.net : (e.teleop.net ? 1 : 0)) + (typeof e.teleop.prosser === 'number' ? e.teleop.prosser : (e.teleop.prosser ? 1 : 0))));

      // endgame majority for this match
      const majority = (arr: any[], fn: (v: any) => boolean) => {
        if (!arr || arr.length === 0) return false;
        const yes = arr.filter(fn).length;
        return yes / arr.length >= 0.5;
      };
      const isHighClimb = majority(scouterEntries, (s) => (s.endgame?.climb === 'high'));
      const isDied = majority(scouterEntries, (s) => (s.endgame?.died && s.endgame.died !== 'none'));

      const mapDriver = (v: any) => (v === 'low' ? 1 : v === 'medium' ? 2 : v === 'high' ? 3 : 0);
      const mapSpeed = (v: any) => (v === 'slow' ? 1 : v === 'medium' ? 2 : v === 'fast' ? 3 : 0);
      const mapDefense = (v: any) => (v === 'none' ? 1 : v === 'bad' ? 2 : v === 'ok' ? 3 : v === 'great' ? 4 : 0);

      const avgDriverVal = avg(scouterEntries.map(e => mapDriver(e.endgame?.driverSkill)));
      const avgSpeedVal = avg(scouterEntries.map(e => mapSpeed(e.endgame?.robotSpeed)));
      const avgDefVal = avg(scouterEntries.map(e => mapDefense(e.defense)));

      const mapBackDriver = (v: number) => v <= 1.5 ? 'Low' : v <= 2.5 ? 'Medium' : 'High';
      const mapBackSpeed = (v: number) => v <= 1.5 ? 'Slow' : v <= 2.5 ? 'Medium' : 'Fast';
      const mapBackDefense = (v: number) => v <= 1.5 ? 'None/Bad' : v <= 2.5 ? 'OK' : 'Great';

      const matchInfo = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt).find((m: any) => m.key === mk);
      const matchLabel = matchInfo ? `${matchInfo.comp_level} ${matchInfo.match_number}` : mk;

      return {
        matchKey: mk,
        matchLabel,
        scouterCount: scouterEntries.length,
        avgAutoL1: Math.round(avgAutoL1 * 100) / 100,
        avgAutoL2: Math.round(avgAutoL2 * 100) / 100,
        avgAutoL3: Math.round(avgAutoL3 * 100) / 100,
        avgAutoL4: Math.round(avgAutoL4 * 100) / 100,
        avgAutoNet: Math.round(avgAutoNet * 100) / 100,
  avgAutoPros: Math.round(avgAutoPros * 100) / 100,
        avgAutoTotal: Math.round(avgAutoTotal * 100) / 100,
        avgTeleopL1: Math.round(avgTeleopL1 * 100) / 100,
        avgTeleopL2: Math.round(avgTeleopL2 * 100) / 100,
        avgTeleopL3: Math.round(avgTeleopL3 * 100) / 100,
        avgTeleopL4: Math.round(avgTeleopL4 * 100) / 100,
        avgTeleopNet: Math.round(avgTeleopNet * 100) / 100,
        avgTeleopPros: Math.round(avgTeleopPros * 100) / 100,
        avgTeleopTotal: Math.round(avgTeleopTotal * 100) / 100,
        highClimb: isHighClimb ? 'High' : 'No',
        died: isDied ? 'Yes' : 'No',
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
    if (showAuto) headers.push('Auto L1', 'Auto L2', 'Auto L3', 'Auto L4', 'Auto Net', 'Auto Avg', 'Auto Avg Points');
    if (showTeleop) headers.push('Tele L1', 'Tele L2', 'Tele L3', 'Tele L4', 'Tele Prosser', 'Tele Avg', 'Tele Avg Points', 'Tele Net');
    // endgame columns
    headers.push('High Climb', 'Died (count/matches)', 'Driver Skill', 'Robot Speed', 'Defense');
    const rowsCsv = filtered.map(t => {
      const base: (string|number)[] = [t.team, t.count];
  if (showAuto) base.push(t.avgAutoL1, t.avgAutoL2, t.avgAutoL3, t.avgAutoL4, t.avgAutoNet, t.avgAuto, t.avgAutoPoints);
  if (showTeleop) base.push(t.avgTeleopL1, t.avgTeleopL2, t.avgTeleopL3, t.avgTeleopL4, t.avgTeleopProsser, t.avgTeleop, t.avgTeleopPoints, t.avgTeleopNet);
  base.push(`${t.highClimbCount}/${t.matchesPlayed}`, `${t.diedCount}/${t.matchesPlayed}`, t.driverSkill, t.robotSpeed, t.defense);
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
                  const mapped = serverRows.map((r: any) => ({
                    id: r.id,
                    matchKey: r.match_key,
                    teamKey: r.team_key,
                    scouter: r.scouter_name,
                    alliance: r.alliance,
                    position: r.position,
                    auto: {
                      ...(r.payload?.auto || { l1: 0, l2: 0, l3: 0, l4: 0, hasAuto: false }),
                      net: typeof r.payload?.auto?.net === 'number' ? r.payload.auto.net : (r.payload?.auto?.net ? 1 : 0),
                      prosser: typeof r.payload?.auto?.prosser === 'number' ? r.payload.auto.prosser : (r.payload?.auto?.prosser ? 1 : 0),
                    },
                    teleop: {
                      ...(r.payload?.teleop || { l1: 0, l2: 0, l3: 0, l4: 0 }),
                      net: typeof r.payload?.teleop?.net === 'number' ? r.payload.teleop.net : (r.payload?.teleop?.net ? 1 : 0),
                      prosser: typeof r.payload?.teleop?.prosser === 'number' ? r.payload.teleop.prosser : (r.payload?.teleop?.prosser ? 1 : 0),
                    },
                    endgame: r.payload?.endgame || { climb: 'none' },
                    defense: r.payload?.defense || 'none',
                    timestamp: r.timestamp ? Date.parse(r.timestamp) : Date.now(),
                  }));
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

        
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-3 font-medium text-gray-900 pl-3">Team</th>
                      <th className="text-left py-3 font-medium text-gray-900 pl-6 border-l border-gray-300">Entries</th>
                      <th onClick={() => toggleSort('avgAutoL1')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Auto L1</th>
                      <th onClick={() => toggleSort('avgAutoL2')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Auto L2</th>
                      <th onClick={() => toggleSort('avgAutoL3')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Auto L3</th>
                      <th onClick={() => toggleSort('avgAutoL4')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Auto L4</th>
                      <th onClick={() => toggleSort('avgAutoNet')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Auto Net</th>
                      <th onClick={() => toggleSort('avgTeleopL1')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Tele L1</th>
                      <th onClick={() => toggleSort('avgTeleopL2')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Tele L2</th>
                      <th onClick={() => toggleSort('avgTeleopL3')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Tele L3</th>
                      <th onClick={() => toggleSort('avgTeleopL4')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Tele L4</th>
                      <th onClick={() => toggleSort('avgTeleopNet')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Tele Net</th>
                      <th onClick={() => toggleSort('avgTeleopProsser')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Tele Prosser</th>
                      <th onClick={() => toggleSort('avgAuto')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Auto Avg</th>
                      <th onClick={() => toggleSort('avgTeleop')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Teleop Avg</th>
                      <th onClick={() => toggleSort('avgAutoPoints')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Avg Auto Points</th>
                      <th onClick={() => toggleSort('avgTeleopPoints')} className="text-left py-3 font-medium text-gray-900 cursor-pointer pl-6 border-l border-gray-300">Avg Teleop Points</th>
                      <th className="text-left py-3 font-medium text-gray-900 pl-6 border-l border-gray-300">Matches Scouted</th>
                      <th className="text-left py-3 font-medium text-gray-900 pl-6 border-l border-gray-300">High Climb</th>
                      <th className="text-left py-3 font-medium text-gray-900 pl-6 border-l border-gray-300">Died</th>
                      <th className="text-left py-3 font-medium text-gray-900 pl-6 border-l border-gray-300">Driver Skill</th>
                      <th className="text-left py-3 font-medium text-gray-900 pl-6 border-l border-gray-300">Robot Speed</th>
                      <th className="text-left py-3 font-medium text-gray-900 pl-6 border-l border-gray-300">Defense</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((t) => (
                      <tr key={t.teamKey} className="border-b border-gray-300 hover:bg-gray-50">
                        <td className="py-3 font-medium text-gray-900 pl-3">
                          <button onClick={() => openTeamDetail(t.teamKey)} className="text-left text-blue-600 hover:underline">
                            {t.team}
                          </button>
                        </td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.count}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgAutoL1.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgAutoL2.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgAutoL3.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgAutoL4.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgAutoNet.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleopL1.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleopL2.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleopL3.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleopL4.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleopNet.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleopProsser.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgAuto.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleop.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgAutoPoints.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.avgTeleopPoints.toFixed(2)}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.matchesPlayed}/{t.matchesScheduled}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.highClimbCount}/{t.matchesPlayed}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.diedCount}/{t.matchesPlayed}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.driverSkill}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.robotSpeed}</td>
                        <td className="py-3 text-gray-600 pl-6 border-l border-gray-300">{t.defense}</td>
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
                      <th className="text-left py-2 align-top pl-3">Match</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Scouters</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Auto Total</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Auto L1</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Auto L2</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Auto L3</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Auto L4</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Auto Net</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Tele Total</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Tele L1</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Tele L2</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Tele L3</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Tele L4</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Tele Net</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Tele Prosser</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">High Climb</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Died</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Driver Skill</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Robot Speed</th>
                      <th className="text-left py-2 align-top pl-6 border-l border-gray-300">Defense</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMatches.map(m => (
                      m.notScouted ? (
                        <tr key={m.matchKey} className="border-b hover:bg-gray-50 align-top">
                          <td className="py-2 align-top break-words pl-3">{m.matchLabel}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300" colSpan={19}>
                            <div className="italic text-gray-500 p-3 bg-gray-50 rounded">This match has not been scouted</div>
                          </td>
                        </tr>
                      ) : (
                        <tr key={m.matchKey} className="border-b hover:bg-gray-50 align-top">
                          <td className="py-2 align-top break-words pl-3">{m.matchLabel}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.scouterCount}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgAutoTotal.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgAutoL1.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgAutoL2.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgAutoL3.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgAutoL4.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgAutoNet.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgTeleopTotal.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgTeleopL1.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgTeleopL2.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgTeleopL3.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgTeleopL4.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgTeleopNet.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.avgTeleopPros.toFixed(2)}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.highClimb}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.died}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.driverSkill}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.robotSpeed}</td>
                          <td className="py-2 align-top pl-6 border-l border-gray-300">{m.defense}</td>
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