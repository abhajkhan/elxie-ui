import type { CanonicalGameId } from "@/types/protocol";

export type DirectionInvertGameState = "INSTRUCTIONS" | "RUNNING" | "RESULT";

export type InversionType =
  | "forward_backward"
  | "steering"
  | "full"
  | "dynamic";

export type DirectionRule = {
  playerInput: "Up (Forward)" | "Down (Backward)" | "Left" | "Right";
  robotAction: "Backward" | "Forward" | "Left" | "Right";
  isInverted: boolean;
};

export type ObjectiveStatus = "pending" | "passed" | "failed";

export type DirectionInvertObjective = {
  id: 1 | 2 | 3;
  title: string;
  description: string;
  status: ObjectiveStatus;
};

export type DirectionInvertLevelConfig = {
  id: number;
  title: string;
  concept: string;
  inversionType: InversionType;
  rules: DirectionRule[];
  objectives: DirectionInvertObjective[];
};

export type LevelProgress = {
  level: number;
  bestScore: number;
  stars: 0 | 1 | 2 | 3;
  attempts?: number;
  unlocked?: boolean;
  timestamp?: number;
};
