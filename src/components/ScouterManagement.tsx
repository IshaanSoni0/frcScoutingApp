import React, { useState } from 'react';
import { Scouter } from '../types';
import { uuidv4 } from '../utils/uuid';
// DataService not required here; scouters persisted via useLocalStorage
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';
import { pushScoutersToServer, migrateLocalToServer, fetchServerScouters } from '../services/syncService';
import { getSupabaseInfo } from '../services/supabaseClient';
import { SyncControl } from './SyncControl';

interface ScouterManagementProps {
  onBack: () => void;
}

export function ScouterManagement({ onBack }: ScouterManagementProps) {
  const [scouters, setScouters] = useLocalStorage<Scouter[]>('frc-scouters', []);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
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

  const exportScouters = () => {
    try {
      const raw = JSON.stringify(scouters, null, 2);
      navigator.clipboard?.writeText(raw);
      // also trigger a download
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `scouters-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusMessage('Exported scouters to clipboard and downloaded file');
    } catch (e) {
      setStatusMessage('Failed to export scouters: ' + (e as any)?.message || String(e));
    }
  };

  const forcePushScouters = async () => {
    try {
      setStatusMessage('Forcing push to server...');
      const res = await pushScoutersToServer(scouters);
      setStatusMessage(String(res || 'Force push completed'));
    } catch (e: any) {
      setStatusMessage(e?.message ? String(e.message) : String(e));
    }
  };

  // auto-refresh when this view loads
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await migrateLocalToServer();
        // fetch server scouters to update local view (SyncControl already does this but we want immediate refresh)
        const server = await fetchServerScouters();
        if (!mounted) return;
        if (Array.isArray(server) && server.length > 0) {
          // user-facing scouters are stored via useLocalStorage hook; update only if server returns rows
          setScouters((prev) => {
            // map server rows to local shape and merge
            const mapped = server.map((s: any) => ({ id: s.id, name: s.name, alliance: s.alliance, position: s.position, isRemote: s.is_remote ?? s.isRemote ?? false, updatedAt: s.updated_at ? Date.parse(s.updated_at) : Date.now(), deletedAt: s.deleted_at ? Date.parse(s.deleted_at) : null }));
            // simple replace to prefer server authoritative scouter list
            return mapped as any;
          });
        }
      } catch (e) {
        // ignore refresh errors
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showClientInfo = () => {
    try {
      const info = getSupabaseInfo();
      setStatusMessage(`Supabase: url=${info.url ? 'present' : 'missing'}, hasKey=${info.hasKey}, clientPresent=${info.clientPresent}`);
    } catch (e) {
      setStatusMessage('Failed to read Supabase info: ' + (e as any)?.message || String(e));
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
      <div className="flex items-center gap-3">
        <SyncControl onSync={() => migrateLocalToServer()} onCheck={() => fetchServerScouters()} />
      </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Scouter Management</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={exportScouters} className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1 rounded-md">Export</button>
              <button onClick={forcePushScouters} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md">Force Push</button>
              <button onClick={showClientInfo} className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded-md">Client Info</button>
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
      </div>
    </div>
  );
}