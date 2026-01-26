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
    // number of fuel scored in the hub during autonomous
    fuel?: number;
    // where fuel was collected from
    neutralZone?: boolean;
    depot?: boolean;
    outpost?: boolean;
    // climbed in auto
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
      defense?: 'na' | 'bad' | 'average' | 'good';
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
      defense?: 'na' | 'bad' | 'average' | 'good';
      neutralZone?: boolean;
      depot?: boolean;
      outpost?: boolean;
      launchedToSide?: boolean;
    };
  };
  endgame: {
    climb: 'none' | 'level1' | 'level2' | 'level3';
    // trench capability
    trench?: 'yes' | 'no' | 'na';
    // shooting accuracy
    shootingAccuracy?: 'na' | 'very_inaccurate' | 'inaccurate' | 'moderately_accurate' | 'accurate' | 'very_accurate';
    // shooting speed
    shootingSpeed?: 'na' | 'very_slow' | 'slow' | 'average' | 'moderately_fast' | 'very_fast';
    // intake speed
    intakeSpeed?: 'na' | 'very_slow' | 'slow' | 'average' | 'moderately_fast' | 'very_fast';
    // driving speed
    drivingSpeed?: 'na' | 'very_slow' | 'slow' | 'average' | 'moderately_fast' | 'very_fast';
    // driving skill
    drivingSkill?: 'na' | 'poor' | 'average' | 'good' | 'excellent';
    // robot disability
    robotDisability?: 'none' | 'small_part' | 'about_half' | 'nearly_whole';
    // robot range
    robotRange?: 'na' | 'short' | 'average' | 'long' | 'very_long';
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