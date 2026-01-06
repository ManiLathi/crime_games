
export type GameRole = 'POLICE' | 'ADVOCATE';

export type InvestigativeTool = 'GLOVES' | 'TORCH' | 'UV_LIGHT' | 'EVIDENCE_BAG' | 'RECORDER' | 'CYBER_KIT';

export interface Character {
  name: string;
  role: string;
  specialty: string;
  avatarIcon: string;
}

export interface Evidence {
  id: string;
  name: string;
  description: string;
  isLegal: boolean; 
  strength: number; 
  category: 'PHYSICAL' | 'DIGITAL' | 'FORENSIC' | 'STATEMENT';
  requiredTool: InvestigativeTool;
}

export interface LevelInfo {
  id: number;
  title: string;
  crimeType: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  unlocked: boolean;
}

export interface Case {
  title: string;
  victim: string;
  backstory: string;
  suspects: Suspect[];
  rooms: Room[];
  legalSections: string[];
}

export interface Suspect {
  name: string;
  role: string;
  motive: string;
  alibi: string;
  isGuilty: boolean;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  clue: Evidence;
  imageUrl?: string;
  hotspots?: { x: number; y: number; label: string }[];
}

export type GameState = 
  | 'LEVEL_SELECT' 
  | 'LOADING' 
  | 'BRIEFING' 
  | 'POLICE_INVESTIGATION' 
  | 'ADVOCATE_ANALYSIS' 
  | 'COURTROOM' 
  | 'VERDICT';

export interface Verdict {
  outcome: 'CONVICTION' | 'ACQUITTAL' | 'BAIL' | 'CASE_COLLAPSE';
  reasoning: string;
  integrityScore: number;
  legalAccuracy: number;
}

export interface PlayerPos {
  x: number;
  y: number;
}
