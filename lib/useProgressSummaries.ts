"use client";

import { useEffect, useState } from "react";
import { gameCatalog } from "@/data/gameCatalog";
import { fetchAndSyncProgress, readAllLocalProgressSummaries } from "@/lib/progressStore";

export type ProgressSummary = {
  progressPercentage: number;
  completedLevels: number;
  totalLevels: number;
};

/**
 * Per-game progress summaries keyed by game id. Hydrates from local storage
 * immediately, then merges the server copy. `synced` turns true once the
 * server round-trip has settled (success or failure).
 */
export function useProgressSummaries() {
  // Initialize with empty record to ensure SSR HTML matches initial client hydration
  const [progress, setProgress] = useState<Record<string, ProgressSummary>>({});
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    // 1. Immediately hydrate client state from local storage cache on mount
    setProgress(readAllLocalProgressSummaries());

    // 2. Sync with server in background
    let isMounted = true;
    const supportedGames = gameCatalog.filter((game) => game.progressSupported);

    Promise.all(
      supportedGames.map(
        async (game) => [game.id, await fetchAndSyncProgress(game.slug)] as const
      )
    )
      .then((items) => {
        if (isMounted) {
          setProgress((prev) => ({
            ...prev,
            ...Object.fromEntries(
              items.map(([id, result]) => [
                id,
                {
                  progressPercentage: result.progressPercentage,
                  completedLevels: result.completedLevels,
                  totalLevels: result.totalLevels,
                },
              ])
            ),
          }));
        }
      })
      .catch((error) => console.warn("[PROGRESS] Failed to sync game progress:", error))
      .finally(() => {
        if (isMounted) setSynced(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { progress, synced };
}
