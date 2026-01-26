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
    fuel?: number;
    neutralZone?: boolean;
    depot?: boolean;
    outpost?: boolean;
    climbed?: boolean;
  };
  teleop: {
    transition?: {
      fuel?: number;
      neutralZone?: boolean;
      depot?: boolean;
      outpost?: boolean;
    };
    firstOffence?: {
      fuel?: number;
      neutralZone?: boolean;
      depot?: boolean;
      outpost?: boolean;
      launchedToSide?: boolean;
    };
    firstDefense?: {
      defenseRating?: 'na' | 'bad' | 'average' | 'good';
      neutralZone?: boolean;
      depot?: boolean;
      outpost?: boolean;
      launchedToSide?: boolean;
    };
    secondOffence?: {
      fuel?: number;
      neutralZone?: boolean;
      depot?: boolean;
      outpost?: boolean;
      launchedToSide?: boolean;
    };
    secondDefense?: {
      defenseRating?: 'na' | 'bad' | 'average' | 'good';
      neutralZone?: boolean;
      depot?: boolean;
      outpost?: boolean;
      launchedToSide?: boolean;
    };
  };
  endgame: {
    trenchAbility?: 'yes' | 'no' | 'na';
    climbLevel?: 'none' | 'level1' | 'level2' | 'level3';
    shootingAccuracy?: 'na' | 'very inaccurate' | 'inaccurate' | 'moderately accurate' | 'accurate' | 'very accurate';
    shootingSpeed?: 'na' | 'very slow' | 'slow' | 'average' | 'moderately fast' | 'very fast';
    intakeSpeed?: 'na' | 'very slow' | 'slow' | 'average' | 'moderately fast' | 'very fast';
    drivingSpeed?: 'na' | 'very slow' | 'slow' | 'average' | 'moderately fast' | 'very fast';
    drivingSkill?: 'na' | 'poor' | 'average' | 'good' | 'excellent';
    robotDisability?: 'none' | 'small part of match' | 'about half of match' | 'nearly the whole match';
    robotRange?: 'na' | 'short' | 'average' | 'long' | 'very long';
    notes?: string;
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