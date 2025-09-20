import React, { useState } from 'react';
import { Scouter } from '../types';
import { DataService } from '../services/dataService';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ArrowLeft, Plus, Trash2, Users } from 'lucide-react';

interface ScouterManagementProps {
  onBack: () => void;
}

export function ScouterManagement({ onBack }: ScouterManagementProps) {
  const [scouters, setScouters] = useLocalStorage<Scouter[]>('frc-scouters', []);
  const [newScouter, setNewScouter] = useState({
    name: '',
    alliance: 'red' as 'red' | 'blue',
    position: 1 as 1 | 2 | 3,
    isRemote: false,
  });

  const addScouter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScouter.name.trim()) return;

    const scouter: Scouter = {
      id: Date.now().toString(),
      ...newScouter,
      name: newScouter.name.trim(),
    };

    setScouters([...scouters, scouter]);
    setNewScouter({ name: '', alliance: 'red', position: 1, isRemote: false });
  };

  const removeScouter = (id: string) => {
    setScouters(scouters.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Admin Panel
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">Scouter Management</h1>
          </div>
        </div>

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
                  {scouters.map((scouter) => (
                    <tr key={scouter.id} className="border-b border-gray-100">
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
                      <td className="py-3">
                        <button
                          onClick={() => removeScouter(scouter.id)}
                          className="text-red-600 hover:text-red-900 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
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