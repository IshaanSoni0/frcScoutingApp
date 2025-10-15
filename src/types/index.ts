export interface User {
  username: string;
  alliance: 'red' | 'blue';
  position: 1 | 2 | 3;
  isAdmin: boolean;
}

export interface Match {
  key: string;
  match_number: number;
  comp_level: string;
  alliances: {
    red: {
      team_keys: string[];
    };
    blue: {
      team_keys: string[];
    };
  };
}

export interface ScoutingData {
  id: string;
  matchKey: string;
  teamKey: string;
  scouter: string;
  alliance: 'red' | 'blue';
  position: number;
  auto: {
    l1: number;
    l2: number;
    l3: number;
    l4: number;
    hasAuto: boolean;
    net?: boolean;
    prosser?: boolean;
  };
  teleop: {
    l1: number;
    l2: number;
    l3: number;
    l4: number;
    net?: boolean;
    prosser?: boolean;
  };
  endgame: {
    climb: 'none' | 'low' | 'deep';
    driverSkill?: 'low' | 'medium' | 'high';
    robotSpeed?: 'slow' | 'medium' | 'fast';
  died?: 'none' | 'partway' | 'start';
  };
  defense: 'none' | 'bad' | 'ok' | 'great';
  timestamp: number;
}

export interface Scouter {
  id: string;
  name: string;
  alliance: 'red' | 'blue';
  position: 1 | 2 | 3;
  isRemote: boolean;
  updatedAt?: number; // ms since epoch
  deletedAt?: number | null;
}

export interface Event {
  key: string;
  name: string;
  start_date: string;
  end_date: string;
}