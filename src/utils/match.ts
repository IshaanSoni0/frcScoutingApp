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

// Parse a TBA match key like 2025azfg_sf12m1 -> { comp_level: 'sf', set_number: 12, match_number: 1 }
export function parseMatchKey(key: string) {
  try {
    // common pattern: <year><event>_<comp_level><set?>m<match>
    // examples: 2025azfg_qm10, 2025azfg_sf12m1, 2025azfg_f1m3
    const parts = key.split('_');
    if (parts.length < 2) return null;
    const suffix = parts[1];
    // comp_level is letters before digits. Accept extra trailing chars after match number.
    const m = suffix.match(/^([a-z]+)(\d*)m?(\d+)?.*$/i);
    if (!m) return null;
    const comp_level = m[1];
    const maybeSet = m[2];
    const maybeMatch = m[3];
    const set_number = maybeSet ? parseInt(maybeSet, 10) : undefined;
    const match_number = maybeMatch ? parseInt(maybeMatch, 10) : undefined;
    return { comp_level, set_number, match_number } as any;
  } catch (e) {
    return null;
  }
}

// Return a string label a scouter would expect for a match
export function readableMatchLabel(m: any) {
  const parsed = m && m.key ? parseMatchKey(m.key) : null;
  const lvl = m.comp_level || parsed?.comp_level || 'qm';
  const setNumber = m.set_number ?? parsed?.set_number;
  const matchNumber = m.match_number ?? parsed?.match_number;
  if (lvl === 'qm') return `Qualification ${matchNumber}`;
  const name = compLevelName(lvl);
  if (setNumber) return `${name} ${setNumber} - Match ${matchNumber}`;
  return `${name} ${matchNumber}`;
}

// Comparator for matches: by comp level rank, then set_number (if present), then match_number, then key
export function compareMatches(a: any, b: any) {
  const aParsed = a && a.key ? parseMatchKey(a.key) : null;
  const bParsed = b && b.key ? parseMatchKey(b.key) : null;

  const aComp = String(a.comp_level ?? aParsed?.comp_level ?? '').toLowerCase();
  const bComp = String(b.comp_level ?? bParsed?.comp_level ?? '').toLowerCase();
  const ra = compLevelRank[aComp] ?? 99;
  const rb = compLevelRank[bComp] ?? 99;
  if (ra !== rb) return ra - rb;

  // For playoff levels, prefer set_number then match_number
  const aSet = a.set_number ?? aParsed?.set_number ?? 0;
  const bSet = b.set_number ?? bParsed?.set_number ?? 0;
  if (aSet !== bSet) return aSet - bSet;

  const aMatch = a.match_number ?? aParsed?.match_number ?? 0;
  const bMatch = b.match_number ?? bParsed?.match_number ?? 0;
  if (aMatch !== bMatch) return aMatch - bMatch;
  return String(a.key).localeCompare(String(b.key));
}
