import React, { useState } from 'react';
import { User } from '../types';
import { Users, Shield } from 'lucide-react';
import { DataService } from '../services/dataService';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [alliance, setAlliance] = useState<'red' | 'blue'>('red');
  const [position, setPosition] = useState<1 | 2 | 3>(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const name = username.trim();
    const isAdmin = name.toLowerCase() === 'admin6560';

    if (isAdmin) {
      onLogin({ username: name, alliance, position, isAdmin: true });
      return;
    }

    // Validate against scouters added by admin (case-insensitive match on scouter.name)
    const scouters = DataService.getScouters();
    const matched = scouters.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!matched) {
      setShowInvalid(true);
      return;
    }

    onLogin({
      username: matched.name,
      alliance: matched.alliance,
      position: matched.position,
      isAdmin: false,
    });
  };

  const [showInvalid, setShowInvalid] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">FRC Scout</h1>
          <p className="text-gray-600">Competition Scouting System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
          {showInvalid && (
            <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-sm">
                <h3 className="text-lg font-semibold mb-2">Invalid username</h3>
                <p className="text-gray-600 mb-4">The username you entered is not a registered scouter. Please check with your admin.</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => setShowInvalid(false)}
                    className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          )}
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label htmlFor="alliance" className="block text-sm font-medium text-gray-700 mb-2">
              Alliance
            </label>
            <select
              id="alliance"
              value={alliance}
              onChange={(e) => setAlliance(e.target.value as 'red' | 'blue')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value="red">Red Alliance</option>
              <option value="blue">Blue Alliance</option>
            </select>
          </div>

          <div>
            <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-2">
              Team Position
            </label>
            <select
              id="position"
              value={position}
              onChange={(e) => setPosition(Number(e.target.value) as 1 | 2 | 3)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            >
              <option value={1}>Team 1</option>
              <option value={2}>Team 2</option>
              <option value={3}>Team 3</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            {username === 'admin6560' && <Shield className="w-5 h-5" />}
            {username === 'admin6560' ? 'Admin Login' : 'Start Scouting'}
          </button>
        </form>
      </div>
    </div>
  );
}