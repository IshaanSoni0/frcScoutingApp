import { useState, useEffect } from 'react';
import { User, Match } from './types';
import { DataService } from './services/dataService';
import { LoginPage } from './components/LoginPage';
import { MatchList } from './components/MatchList';
import { ScoutingForm } from './components/ScoutingForm';
import { AdminPanel } from './components/AdminPanel';

type AppState = 'login' | 'matches' | 'scouting' | 'admin';

function App() {
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
      <MatchList
        matches={matches}
        user={user}
        onMatchSelect={handleMatchSelect}
        onBack={handleLogout}
      />
    );
  }

  return <LoginPage onLogin={handleLogin} />;
}

export default App;