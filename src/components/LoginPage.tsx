import React, { useState } from 'react';
import { User } from '../types';
import { Users, Shield } from 'lucide-react';
import { DataService } from '../services/dataService';
import supabase from '../services/supabaseClient';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [alliance, _setAlliance] = useState<'red' | 'blue'>('red');
  const [position, _setPosition] = useState<1 | 2 | 3>(1);

  const [showInvalid, setShowInvalid] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;

    const name = username.trim();
    const isAdmin = name.toLowerCase() === 'admin6560';

    if (isAdmin) {
      // simple admin password check against Supabase 'admins' table (insecure by design)
      try {
        if (!supabase) {
          // Supabase isn't configured (often happens in development). Fall back to the local dev admin password.
          // This is intentionally insecure and only for convenience/testing.
          // eslint-disable-next-line no-console
          console.warn('Supabase client not configured; falling back to local admin password check');
          if (password === 'arsen') {
            onLogin({ username: name, alliance, position, isAdmin: true });
            return;
          }
          setErrorMessage('Incorrect admin password.');
          setShowInvalid(true);
          return;
        }

        // If Supabase is configured, try DB-backed admin check first
        const { data, error } = await supabase.from('admins').select('password').eq('username', name).limit(1).single();
        if (error) {
          // If there's a DB error, log it and fallback to the plaintext 'arsen' password for convenience
          // eslint-disable-next-line no-console
          console.error('Supabase admin lookup error, falling back to local password check', error);
          if (password === 'arsen') {
            onLogin({ username: name, alliance, position, isAdmin: true });
            return;
          }
          setErrorMessage('Admin login failed: admin record not found or DB error. See console for details.');
          setShowInvalid(true);
          return;
        }

        if (!data) {
          setErrorMessage('Admin login failed: admin record not found.');
          // eslint-disable-next-line no-console
          console.warn('Supabase admin lookup returned no rows');
          setShowInvalid(true);
          return;
        }

        if (data.password !== password) {
          setErrorMessage('Incorrect admin password.');
          setShowInvalid(true);
          return;
        }

        onLogin({ username: name, alliance, position, isAdmin: true });
        return;
      } catch (e) {
        setErrorMessage('Admin login error (see console for details).');
        // eslint-disable-next-line no-console
        console.error('Admin login exception', e);
        setShowInvalid(true);
        return;
      }
    }

    // Validate against scouters added by admin (case-insensitive match on scouter.name)
    const scouters = DataService.getScouters();
    const matched = scouters.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (!matched) {
      setErrorMessage('The username you entered is not a registered scouter. Please check with your admin.');
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
                  <h3 className="text-lg font-semibold mb-2">Login error</h3>
                  <p className="text-gray-600 mb-4">{errorMessage || 'The username you entered is not a registered scouter. Please check with your admin.'}</p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => { setShowInvalid(false); setErrorMessage(''); }}
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
            {username.toLowerCase() === 'admin6560' && (
              <div className="mt-3">
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="Admin password"
                  required
                />
              </div>
            )}
          </div>

          {/* Admin-specific selectors removed from login form. Admin can log in with username 'admin6560' and manage scouters from the Admin Panel. */}

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