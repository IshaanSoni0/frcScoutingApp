import React, { useState } from 'react';
import { Scouter } from '../types';
import { uuidv4 } from '../utils/uuid';
// DataService not required here; scouters persisted via useLocalStorage
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';
import { DataService } from '../services/dataService';
import { readableMatchLabel } from '../utils/match';
import { pushScoutersToServer, performFullRefresh } from '../services/syncService';
// no direct supabase client usage here

interface ScouterManagementProps {
  onBack: () => void;
}

export function ScouterManagement({ onBack }: ScouterManagementProps) {
  const [scouters, setScouters] = useLocalStorage<Scouter[]>('frc-scouters', []);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showScoutedModal, setShowScoutedModal] = useState(false);
  const [modalScouterName, setModalScouterName] = useState<string | null>(null);
  const [modalScoutedMatches, setModalScoutedMatches] = useState<Array<{ matchKey: string; label: string }>>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({
    name: '',
    alliance: 'red' as 'red' | 'blue',
    position: 1 as 1 | 2 | 3,
    isRemote: false,
  });
  const [newScouter, setNewScouter] = useState({
    name: '',
    alliance: 'red' as 'red' | 'blue',
    position: 1 as 1 | 2 | 3,
    isRemote: false,
  });

  const addScouter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScouter.name.trim()) return;
    const scouter: Scouter = {
      id: uuidv4(),
      ...newScouter,
      name: newScouter.name.trim(),
      updatedAt: Date.now(),
      deletedAt: null,
    };

    const updated = [...scouters, scouter];
    setScouters(updated);
    // push to server and show result (await to avoid race with Sync)
    try {
      const msg = await pushScoutersToServer(updated);
      setStatusMessage(msg as string);
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
    setNewScouter({ name: '', alliance: 'red', position: 1, isRemote: false });
  };

  

  // auto-refresh when this view loads
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await performFullRefresh({ reload: false });
        // prefer local saved scouters (performFullRefresh will update local storage); read from DataService
        try {
          const local = DataService.getScouters() || [];
          if (mounted && Array.isArray(local) && local.length > 0) setScouters(local as any);
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // ignore refresh errors
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  

  const openScoutedMatches = (scouterName: string) => {
    try {
      const allMatches = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt);
      // use allMatches directly; totalMatches not needed here

      const scouting = DataService.getScoutingData() || [];
      const scoutedFor = scouting.filter((s: any) => (s.scouter || '').toLowerCase() === scouterName.toLowerCase());
      const matchKeys = Array.from(new Set(scoutedFor.map((s: any) => s.matchKey)));

      const mapped = matchKeys.map((mk: string) => {
        const matchInfo = allMatches.find((m: any) => m.key === mk);
        return { matchKey: mk, label: matchInfo ? readableMatchLabel(matchInfo) : mk };
      });

      setModalScouterName(scouterName);
      setModalScoutedMatches(mapped);
      setShowScoutedModal(true);
    } catch (e) {
      console.error('openScoutedMatches failed', e);
      setModalScoutedMatches([]);
      setModalScouterName(scouterName);
      setShowScoutedModal(true);
    }
  };

  const removeScouter = async (id: string) => {
    // soft delete
    const updated = scouters.map(s => s.id === id ? { ...s, deletedAt: Date.now(), updatedAt: Date.now() } : s);
    setScouters(updated);
    try {
      const msg = await pushScoutersToServer(updated);
      setStatusMessage(msg as string);
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
  };

  const startEdit = (scouter: Scouter) => {
    setEditingId(scouter.id);
    setEditValues({
      name: scouter.name,
      alliance: scouter.alliance,
      position: scouter.position,
      isRemote: scouter.isRemote || false,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({ name: '', alliance: 'red', position: 1, isRemote: false });
  };

  const saveEdit = async (id: string) => {
    const updated = scouters.map(s => s.id === id ? { ...s, ...editValues, name: editValues.name.trim(), updatedAt: Date.now() } : s);
    setScouters(updated);
    try {
      const msg = await pushScoutersToServer(updated);
      setStatusMessage(msg as string);
    } catch (err: any) {
      setStatusMessage(err?.message || String(err));
    }
    cancelEdit();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Admin Panel
              </button>
            </div>
          
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Scouter Management</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    setStatusMessage('Refreshing...');
                    await performFullRefresh({ reload: false });
                    setStatusMessage('Refresh complete');
                  } catch (e: any) {
                    setStatusMessage(e?.message || String(e));
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
        {statusMessage && (
          <div className="mt-4 p-3 bg-yellow-50 text-yellow-800 rounded">
            <strong>Sync status:</strong> {statusMessage}
          </div>
        )}

        {/* Add New Scouter Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Add New Scouter</h2>
          <form onSubmit={addScouter} className="grid md:grid-cols-5 gap-4 items-end">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={newScouter.name}
                onChange={(e) => setNewScouter({ ...newScouter, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Scouter name"
                required
              />
            </div>
            
            <div>
              <label htmlFor="alliance" className="block text-sm font-medium text-gray-700 mb-1">
                Alliance
              </label>
              <select
                id="alliance"
                value={newScouter.alliance}
                onChange={(e) => setNewScouter({ ...newScouter, alliance: e.target.value as 'red' | 'blue' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="red">Red</option>
                <option value="blue">Blue</option>
              </select>
            </div>

            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                id="position"
                value={newScouter.position}
                onChange={(e) => setNewScouter({ ...newScouter, position: Number(e.target.value) as 1 | 2 | 3 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>Team 1</option>
                <option value={2}>Team 2</option>
                <option value={3}>Team 3</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isRemote"
                checked={newScouter.isRemote}
                onChange={(e) => setNewScouter({ ...newScouter, isRemote: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
              />
              <label htmlFor="isRemote" className="text-sm text-gray-700">
                Remote
              </label>
            </div>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </form>
        </div>

        {/* Scouters List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Current Scouters</h2>
          
          {scouters.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No scouters assigned yet. Add some scouters above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                      <th className="text-left py-3 font-medium text-gray-900">Matches Scouted</th>
                      <th className="text-left py-3 font-medium text-gray-900">Name</th>
                      <th className="text-left py-3 font-medium text-gray-900">Alliance</th>
                      <th className="text-left py-3 font-medium text-gray-900">Position</th>
                      <th className="text-left py-3 font-medium text-gray-900">Type</th>
                      <th className="text-left py-3 font-medium text-gray-900">Actions</th>
                    </tr>
                </thead>
                <tbody>
                  {scouters.filter(s => !s.deletedAt).map((scouter) => (
                    <tr key={scouter.id} className="border-b border-gray-100">
                        {editingId === scouter.id ? (
                        <>
                            <td className="py-3">
                              <div className="text-sm text-gray-600">-</div>
                            </td>
                          <td className="py-3">
                            <input
                              type="text"
                              value={editValues.name}
                              onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                              className="w-full px-2 py-1 border border-gray-300 rounded-md"
                            />
                          </td>
                          <td className="py-3">
                            <select
                              value={editValues.alliance}
                              onChange={(e) => setEditValues({ ...editValues, alliance: e.target.value as 'red' | 'blue' })}
                              className="px-2 py-1 border border-gray-300 rounded-md"
                            >
                              <option value="red">Red</option>
                              <option value="blue">Blue</option>
                            </select>
                          </td>
                          <td className="py-3">
                            <select
                              value={editValues.position}
                              onChange={(e) => setEditValues({ ...editValues, position: Number(e.target.value) as 1 | 2 | 3 })}
                              className="px-2 py-1 border border-gray-300 rounded-md"
                            >
                              <option value={1}>Team 1</option>
                              <option value={2}>Team 2</option>
                              <option value={3}>Team 3</option>
                            </select>
                          </td>
                          <td className="py-3">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={editValues.isRemote}
                                onChange={(e) => setEditValues({ ...editValues, isRemote: e.target.checked })}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700">Remote</span>
                            </label>
                          </td>
                          <td className="py-3 flex items-center gap-2">
                            <button
                              onClick={() => saveEdit(scouter.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md"
                            >
                              Save
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded-md"
                            >
                              Cancel
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Matches scouted count */}
                          <td className="py-3">
                            {(() => {
                              try {
                                const selectedEvent = DataService.getSelectedEvent();
                                const allMatches = (DataService.getMatches() || []).filter((m: any) => !m.deletedAt);
                                const matchesForEvent = selectedEvent ? allMatches.filter((m: any) => !m.event_key || m.event_key === selectedEvent) : allMatches;
                                const total = matchesForEvent.length;
                                const scouting = DataService.getScoutingData() || [];
                                const scoutedKeys = Array.from(new Set(scouting.filter((r: any) => (r.scouter || '').toLowerCase() === scouter.name.toLowerCase()).map((r: any) => r.matchKey)));
                                const scoutedCount = scoutedKeys.filter((k: string) => matchesForEvent.some((m: any) => m.key === k)).length;
                                return (
                                  <button onClick={() => openScoutedMatches(scouter.name)} className="text-sm text-blue-600 hover:underline">
                                    {scoutedCount}/{total}
                                  </button>
                                );
                              } catch (e) {
                                return <div className="text-sm text-gray-600">0/0</div>;
                              }
                            })()}
                          </td>
                          <td className="py-3 text-gray-900">{scouter.name}</td>
                          <td className="py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded text-white ${
                              scouter.alliance === 'red' ? 'bg-red-500' : 'bg-blue-500'
                            }`}>
                              {scouter.alliance.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-3 text-gray-900">Team {scouter.position}</td>
                          <td className="py-3">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${
                              scouter.isRemote 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {scouter.isRemote ? 'Remote' : 'In-Person'}
                            </span>
                          </td>
                          <td className="py-3 flex items-center gap-3">
                            <button
                              onClick={() => startEdit(scouter)}
                              className="text-blue-600 hover:text-blue-900 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => removeScouter(scouter.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {showScoutedModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Matches scouted by {modalScouterName}</h3>
              <div className="max-h-64 overflow-y-auto mb-4">
                {modalScoutedMatches.length === 0 ? (
                  <div className="text-sm text-gray-600">No matches scouted yet.</div>
                ) : (
                  <ul className="list-disc pl-5 text-sm">
                    {modalScoutedMatches.map(m => (
                      <li key={m.matchKey} className="py-1">{m.label} <span className="text-xs text-gray-400">({m.matchKey})</span></li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex justify-end">
                <button onClick={() => { setShowScoutedModal(false); setModalScoutedMatches([]); setModalScouterName(null); }} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}