import { gameCatalog, type GameDefinition } from "@/data/gameCatalog";
import type { ProgressSummary } from "@/lib/useProgressSummaries";

/**
 * Elxie Blocks unlocks once every playable, progress-tracked game is finished.
 * Games still marked comingSoon are skipped so an unreleased game can't
 * lock Blocks forever; they count automatically once released.
 */
export const BLOCKS_REQUIRED_GAMES: GameDefinition[] = gameCatalog.filter(
  (game) => game.progressSupported && !game.comingSoon && game.levels.length > 0
);

export function isGameCompleted(game: GameDefinition, summary: ProgressSummary | undefined): boolean {
  return Boolean(summary && summary.completedLevels >= game.levels.length);
}

export function getBlocksUnlockStatus(progress: Record<string, ProgressSummary>) {
  const remaining = BLOCKS_REQUIRED_GAMES.filter((game) => !isGameCompleted(game, progress[game.id]));
  return { unlocked: remaining.length === 0, remaining };
}
