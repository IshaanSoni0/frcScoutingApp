// Local test harness for merge policy used in syncService
// This file duplicates the merge logic in an isolated, testable form and runs a few scenarios.

function parseServerTs(ts) {
  return ts ? Date.parse(ts) : 0;
}

function mergeScouters(localArr, serverArr) {
  const localMap = {};
  localArr.forEach(s => { if (s && s.id) localMap[s.id] = s; });
  const serverMap = {};
  serverArr.forEach(s => { if (s && s.id) serverMap[s.id] = s; });
  const allIds = new Set([...Object.keys(localMap), ...Object.keys(serverMap)]);
  const toUpsert = [];
  const merged = [];

  for (const id of allIds) {
    const l = localMap[id];
    const s = serverMap[id];
    const serverUpdated = s && s.updated_at ? parseServerTs(s.updated_at) : 0;
    const serverDeletedTs = s && s.deleted_at ? parseServerTs(s.deleted_at) : 0;
    const localUpdated = l && l.updatedAt ? l.updatedAt : 0;
    const localDeletedTs = l && l.deletedAt ? l.deletedAt : 0;

    if (s && l) {
      if (localDeletedTs > 0 && (serverDeletedTs === 0 || localDeletedTs > serverUpdated)) {
        toUpsert.push({ id, deleted_at: new Date(localDeletedTs).toISOString() });
        merged.push({ ...l });
      } else if (serverDeletedTs > 0 && (localDeletedTs === 0 || serverDeletedTs > localUpdated)) {
        merged.push({ id: s.id, name: s.name, alliance: s.alliance, position: s.position, isRemote: s.is_remote ?? s.isRemote ?? false, updatedAt: serverUpdated, deletedAt: s.deleted_at ? parseServerTs(s.deleted_at) : null });
      } else {
        if (localUpdated > serverUpdated) {
          toUpsert.push({ id, name: l.name, alliance: l.alliance, position: l.position, is_remote: l.isRemote ?? false, deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null });
          merged.push({ ...l });
        } else {
          merged.push({ id: s.id, name: s.name, alliance: s.alliance, position: s.position, isRemote: s.is_remote ?? s.isRemote ?? false, updatedAt: serverUpdated, deletedAt: s.deleted_at ? parseServerTs(s.deleted_at) : null });
        }
      }
    } else if (l && !s) {
      toUpsert.push({ id, name: l.name, alliance: l.alliance, position: l.position, is_remote: l.isRemote ?? false, deleted_at: l.deletedAt ? new Date(l.deletedAt).toISOString() : null });
      merged.push({ ...l });
    } else if (s && !l) {
      merged.push({ id: s.id, name: s.name, alliance: s.alliance, position: s.position, isRemote: s.is_remote ?? s.isRemote ?? false, updatedAt: serverUpdated, deletedAt: s.deleted_at ? parseServerTs(s.deleted_at) : null });
    }
  }

  return { merged, toUpsert };
}

function assertEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function runTests() {
  const now = Date.now();
  const earlier = now - 10000;
  const later = now + 10000;

  const tests = [];

  // 1) local-only -> upsert expected
  tests.push(() => {
    const local = [{ id: 'a', name: 'LocalOnly', alliance: 'red', position: 1, isRemote: false, updatedAt: now }];
    const server = [];
    const { merged, toUpsert } = mergeScouters(local, server);
    const pass = merged.length === 1 && toUpsert.length === 1 && merged[0].id === 'a';
    return { name: 'local-only upsert', pass, details: { merged, toUpsert } };
  });

  // 2) server-only -> accept server
  tests.push(() => {
    const server = [{ id: 'b', name: 'ServerOnly', alliance: 'blue', position: 2, is_remote: false, updated_at: new Date(earlier).toISOString() }];
    const local = [];
    const { merged, toUpsert } = mergeScouters(local, server);
    const pass = merged.length === 1 && toUpsert.length === 0 && merged[0].id === 'b';
    return { name: 'server-only accept', pass, details: { merged, toUpsert } };
  });

  // 3) both exist, local newer -> upsert local
  tests.push(() => {
    const server = [{ id: 'c', name: 'Name', alliance: 'red', position: 1, is_remote: false, updated_at: new Date(earlier).toISOString() }];
    const local = [{ id: 'c', name: 'NameLocal', alliance: 'red', position: 1, isRemote: false, updatedAt: later }];
    const { merged, toUpsert } = mergeScouters(local, server);
    const pass = merged.length === 1 && toUpsert.length === 1 && merged[0].name === 'NameLocal';
    return { name: 'local-newer wins', pass, details: { merged, toUpsert } };
  });

  // 4) both exist, server newer -> accept server
  tests.push(() => {
    const server = [{ id: 'd', name: 'NameServer', alliance: 'blue', position: 2, is_remote: false, updated_at: new Date(later).toISOString() }];
    const local = [{ id: 'd', name: 'NameLocal', alliance: 'blue', position: 2, isRemote: false, updatedAt: earlier }];
    const { merged, toUpsert } = mergeScouters(local, server);
    const pass = merged.length === 1 && toUpsert.length === 0 && merged[0].name === 'NameServer';
    return { name: 'server-newer wins', pass, details: { merged, toUpsert } };
  });

  // 5) deletion conflict: local deleted newer -> upsert delete
  tests.push(() => {
    const local = [{ id: 'e', name: 'DelLocal', alliance: 'red', position: 1, isRemote: false, updatedAt: earlier, deletedAt: later }];
    const server = [{ id: 'e', name: 'DelLocal', alliance: 'red', position: 1, is_remote: false, updated_at: earlier }];
    const { merged, toUpsert } = mergeScouters(local, server);
    const pass = merged.length === 1 && toUpsert.length === 1 && toUpsert[0].deleted_at; 
    return { name: 'local-deletion-wins', pass, details: { merged, toUpsert } };
  });

  // 6) deletion conflict: server deleted newer -> accept server
  tests.push(() => {
    const server = [{ id: 'f', name: 'DelServer', alliance: 'blue', position: 2, is_remote: false, updated_at: later, deleted_at: new Date(later).toISOString() }];
    const local = [{ id: 'f', name: 'DelServerLocal', alliance: 'blue', position: 2, isRemote: false, updatedAt: earlier }];
    const { merged, toUpsert } = mergeScouters(local, server);
    const pass = merged.length === 1 && toUpsert.length === 0 && merged[0].deletedAt === parseServerTs(server[0].deleted_at);
    return { name: 'server-deletion-wins', pass, details: { merged, toUpsert } };
  });

  const results = tests.map(t => t());
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS ' : 'FAIL '} - ${r.name}`);
    if (!r.pass) {
      allPass = false;
      console.log(' details:', JSON.stringify(r.details, null, 2));
    }
  }
  console.log('\nSummary: ' + (allPass ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'));
  return allPass ? 0 : 1;
}

process.exitCode = runTests();
