import { useState, useEffect } from 'react';
import { User, Match } from './types';
import { DataService } from './services/dataService';
import { LoginPage } from './components/LoginPage';
import { MatchList } from './components/MatchList';
import { ScoutingForm } from './components/ScoutingForm';
import { AdminPanel } from './components/AdminPanel';

type AppState = 'login' | 'matches' | 'scouting' | 'admin';

function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  // detect newly waiting service worker and prompt user to activate it
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setUpdateAvailable(true);
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && reg.waiting) {
            setWaitingWorker(reg.waiting);
            setUpdateAvailable(true);
          }
        });
      });
    });
    // listen for controllerchange to clear the update flag when active
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      setUpdateAvailable(false);
      setWaitingWorker(null);
    });
  }, []);

  const activateUpdate = () => {
    if (!waitingWorker) return;
    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch (e) {}
  };
  const [currentState, setCurrentState] = useState<AppState>('login');
  const [user, setUser] = useState<User | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedScouting, setSelectedScouting] = useState<any | null>(null);

  useEffect(() => {
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      const swUrl = (import.meta as any).env?.BASE_URL ? `${(import.meta as any).env.BASE_URL}sw.js` : '/sw.js';
      navigator.serviceWorker.register(swUrl)
        .then(() => console.log('SW registered at', swUrl))
        .catch(console.error);
    }

    // Load matches from storage
    const storedMatches = DataService.getMatches();
    setMatches(storedMatches);
  }, []);

  // Ensure matches are reloaded whenever we transition to the matches view (e.g., after logout/login or role switch)
  useEffect(() => {
    if (currentState === 'matches') {
      const stored = DataService.getMatches();
      setMatches(stored);
    }
  }, [currentState]);

  const handleLogin = (userData: User) => {
    setUser(userData);
    if (userData.isAdmin) {
      setCurrentState('admin');
    } else {
      setCurrentState('matches');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setSelectedMatch(null);
    setCurrentState('login');
  };

  const handleMatchSelect = (match: Match, existing?: any) => {
    setSelectedMatch(match);
    setSelectedScouting(existing || null);
    setCurrentState('scouting');
  };

  const handleScoutingComplete = () => {
    setSelectedMatch(null);
    setSelectedScouting(null);
    setCurrentState('matches');
    // Reload matches in case they were updated
    const storedMatches = DataService.getMatches();
    setMatches(storedMatches);
  };

  const handleBackToMatches = () => {
    setSelectedMatch(null);
    setCurrentState('matches');
  };

  if (currentState === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  // show update banner across app if update is available
  const maybeUpdateBanner = updateAvailable ? (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-yellow-400 text-black rounded px-4 py-2 shadow">New version available — <button onClick={activateUpdate} className="underline font-semibold">Activate & reload</button></div>
    </div>
  ) : null;

  if (currentState === 'admin' && user?.isAdmin) {
    return <AdminPanel user={user} onLogout={handleLogout} />;
  }

  if (currentState === 'scouting' && selectedMatch && user) {
    return (
      <ScoutingForm
        match={selectedMatch}
        user={user}
        onBack={handleBackToMatches}
        existing={selectedScouting}
        onSubmit={handleScoutingComplete}
      />
    );
  }

  if (currentState === 'matches' && user) {
    return (
      <>
        <MatchList
          matches={matches}
          user={user}
          onMatchSelect={handleMatchSelect}
          onBack={handleLogout}
        />
        {maybeUpdateBanner}
      </>
    );
  }

  return <LoginPage onLogin={handleLogin} />;
}

export default App;