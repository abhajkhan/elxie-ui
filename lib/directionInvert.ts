import { gameCatalog } from "@/data/gameCatalog";
import type {
  DirectionInvertLevelConfig,
  LevelProgress,
} from "@/types/directionInvert";

export const DIRECTION_INVERT_GAME_DEF = gameCatalog.find(
  (game) => game.id === "inverted_drive",
)!;

export const DIRECTION_INVERT_LEVEL_CONFIGS: Record<
  number,
  DirectionInvertLevelConfig
> = {
  1: {
    id: 1,
    title: "Level 1: Forward/Backward Invert",
    concept: "Forward/Backward Invert",
    inversionType: "forward_backward",
    rules: [
      { playerInput: "Up (Forward)", robotAction: "Backward", isInverted: true },
      { playerInput: "Down (Backward)", robotAction: "Forward", isInverted: true },
      { playerInput: "Left", robotAction: "Left", isInverted: false },
      { playerInput: "Right", robotAction: "Right", isInverted: false },
    ],
    objectives: [
      {
        id: 1,
        title: "Safe Drive",
        description: "Drive continuously without colliding with obstacles.",
        status: "pending",
      },
      {
        id: 2,
        title: "Total Turns",
        description: "Complete the required total number of turns.",
        status: "pending",
      },
      {
        id: 3,
        title: "Left & Right Turns",
        description: "Perform the required left and right directional turns.",
        status: "pending",
      },
    ],
  },
  2: {
    id: 2,
    title: "Level 2: Forward/Backward Challenge",
    concept: "Forward/Backward Invert",
    inversionType: "forward_backward",
    rules: [
      { playerInput: "Up (Forward)", robotAction: "Backward", isInverted: true },
      { playerInput: "Down (Backward)", robotAction: "Forward", isInverted: true },
      { playerInput: "Left", robotAction: "Left", isInverted: false },
      { playerInput: "Right", robotAction: "Right", isInverted: false },
    ],
    objectives: [
      {
        id: 1,
        title: "Safe Drive",
        description: "Drive safely without collision under tighter constraints.",
        status: "pending",
      },
      {
        id: 2,
        title: "Increased Total Turns",
        description: "Complete higher turn count requirement.",
        status: "pending",
      },
      {
        id: 3,
        title: "Left & Right Turns",
        description: "Complete required left and right turns.",
        status: "pending",
      },
    ],
  },
  3: {
    id: 3,
    title: "Level 3: Steering Invert",
    concept: "Steering Invert",
    inversionType: "steering",
    rules: [
      { playerInput: "Up (Forward)", robotAction: "Forward", isInverted: false },
      { playerInput: "Down (Backward)", robotAction: "Backward", isInverted: false },
      { playerInput: "Left", robotAction: "Right", isInverted: true },
      { playerInput: "Right", robotAction: "Left", isInverted: true },
    ],
    objectives: [
      {
        id: 1,
        title: "Safe Drive",
        description: "Drive without collision while left and right steering are swapped.",
        status: "pending",
      },
      {
        id: 2,
        title: "Total Turns",
        description: "Complete the required total turns with reversed steering.",
        status: "pending",
      },
      {
        id: 3,
        title: "Left & Right Turns",
        description: "Perform required left and right turns accurately.",
        status: "pending",
      },
    ],
  },
  4: {
    id: 4,
    title: "Level 4: Steering Challenge",
    concept: "Steering Invert",
    inversionType: "steering",
    rules: [
      { playerInput: "Up (Forward)", robotAction: "Forward", isInverted: false },
      { playerInput: "Down (Backward)", robotAction: "Backward", isInverted: false },
      { playerInput: "Left", robotAction: "Right", isInverted: true },
      { playerInput: "Right", robotAction: "Left", isInverted: true },
    ],
    objectives: [
      {
        id: 1,
        title: "Safe Drive",
        description: "Drive safely with reversed steering under higher constraints.",
        status: "pending",
      },
      {
        id: 2,
        title: "Increased Turns",
        description: "Complete higher number of total turns.",
        status: "pending",
      },
      {
        id: 3,
        title: "Left & Right Turns",
        description: "Complete required left and right turns.",
        status: "pending",
      },
    ],
  },
  5: {
    id: 5,
    title: "Level 5: Full Invert",
    concept: "Full Invert",
    inversionType: "full",
    rules: [
      { playerInput: "Up (Forward)", robotAction: "Backward", isInverted: true },
      { playerInput: "Down (Backward)", robotAction: "Forward", isInverted: true },
      { playerInput: "Left", robotAction: "Right", isInverted: true },
      { playerInput: "Right", robotAction: "Left", isInverted: true },
    ],
    objectives: [
      {
        id: 1,
        title: "Safe Drive",
        description: "Drive without collision with both movement and steering inverted.",
        status: "pending",
      },
      {
        id: 2,
        title: "Total Turns",
        description: "Complete required total turns under full control inversion.",
        status: "pending",
      },
      {
        id: 3,
        title: "Left & Right Turns",
        description: "Complete required left and right turns under full inversion.",
        status: "pending",
      },
    ],
  },
  6: {
    id: 6,
    title: "Level 6: Dynamic Invert",
    concept: "Dynamic Invert",
    inversionType: "dynamic",
    rules: [
      { playerInput: "Up (Forward)", robotAction: "Backward", isInverted: true },
      { playerInput: "Down (Backward)", robotAction: "Forward", isInverted: true },
      { playerInput: "Left", robotAction: "Right", isInverted: true },
      { playerInput: "Right", robotAction: "Left", isInverted: true },
    ],
    objectives: [
      {
        id: 1,
        title: "Safe Drive",
        description: "Drive without collision as control mapping shifts mid-drive.",
        status: "pending",
      },
      {
        id: 2,
        title: "Total Turns",
        description: "Complete required total turns through dynamic control changes.",
        status: "pending",
      },
      {
        id: 3,
        title: "Left & Right Turns",
        description: "Complete required left and right turns adapting to live shifts.",
        status: "pending",
      },
    ],
  },
};

export function getLevelConfig(levelId: number): DirectionInvertLevelConfig {
  return (
    DIRECTION_INVERT_LEVEL_CONFIGS[levelId] ?? DIRECTION_INVERT_LEVEL_CONFIGS[1]
  );
}

export function calculateStars(score: number): 0 | 1 | 2 | 3 {
  if (score >= 3) return 3;
  if (score === 2) return 2;
  if (score === 1) return 1;
  return 0;
}

export function isLevelUnlocked(
  levelId: number,
  progressMap: Record<number, { stars: number }>,
  maxLevels = 6,
): boolean {
  if (levelId === 1) return true;
  if (levelId < 1 || levelId > maxLevels) return false;
  const prevLevel = progressMap[levelId - 1];
  return Boolean(prevLevel && prevLevel.stars >= 3);
}

export function calculateGameProgress(
  progressMap: Record<number, { stars: number }>,
  totalLevels = 6,
): { completedLevels: number; totalLevels: number; progressPercentage: number } {
  let completedLevels = 0;
  for (let i = 1; i <= totalLevels; i++) {
    if (progressMap[i] && progressMap[i].stars > 0) {
      completedLevels++;
    }
  }
  return {
    completedLevels,
    totalLevels,
    progressPercentage: Math.round((completedLevels / totalLevels) * 100),
  };
}
