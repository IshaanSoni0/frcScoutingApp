export const compLevelRank: Record<string, number> = {
  qm: 1, // qualification
  ef: 2,
  qf: 3,
  sf: 4,
  f: 5,
};

export function compLevelName(level: string) {
  switch (level) {
    case 'qm': return 'Qualification';
    case 'ef': return 'Eighth-final';
    case 'qf': return 'Quarterfinal';
    case 'sf': return 'Semifinal';
    case 'f': return 'Final';
    default: return level.toUpperCase();
  }
}

// Return a string label a scouter would expect for a match
export function readableMatchLabel(m: any) {
  const lvl = m.comp_level || 'qm';
  const setNumber = m.set_number;
  const matchNumber = m.match_number;
  if (lvl === 'qm') return `Qualification ${matchNumber}`;
  const name = compLevelName(lvl);
  if (setNumber) return `${name} ${setNumber} - Match ${matchNumber}`;
  return `${name} ${matchNumber}`;
}

// Comparator for matches: by comp level rank, then set_number (if present), then match_number, then key
export function compareMatches(a: any, b: any) {
  const ra = compLevelRank[a.comp_level] ?? 99;
  const rb = compLevelRank[b.comp_level] ?? 99;
  if (ra !== rb) return ra - rb;

  // For playoff levels, prefer set_number then match_number
  const aSet = a.set_number ?? 0;
  const bSet = b.set_number ?? 0;
  if (aSet !== bSet) return aSet - bSet;

  if (a.match_number !== b.match_number) return a.match_number - b.match_number;
  return String(a.key).localeCompare(String(b.key));
}
