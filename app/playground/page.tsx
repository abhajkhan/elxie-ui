"use client";

import ModeCard from "@/components/ModeCard";
import { gameCatalog } from "@/data/gameCatalog";
import { getBlocksUnlockStatus } from "@/lib/blocksUnlock";
import { useProgressSummaries } from "@/lib/useProgressSummaries";

export default function Playground() {
  const { progress } = useProgressSummaries();
  const blocks = getBlocksUnlockStatus(progress);

  return (
    <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
      <section className="animate-fade-in">
        <p className="text-sm font-medium text-accent">Welcome back, Player</p>
        <h2 className="mt-2 text-3xl font-black text-white">Ready to play?</h2>
        <p className="mt-2 text-sm leading-6 text-white/50">
          Choose a mode and start your next robot adventure.
        </p>
      </section>

      <section className="mt-8">
        <div className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
            Game modes
          </p>
          <h3 className="mt-1 text-xl font-bold text-white">Choose your mission</h3>
        </div>

        <div className="space-y-3">
          {gameCatalog.map((game, index) => {
            const summary = progress[game.id];
            const defaultTotal = game.levels.length > 0 ? game.levels.length : 6;

            return (
              <ModeCard
                key={game.id}
                index={index}
                title={game.title}
                description={game.description}
                icon={game.icon}
                accent={game.accent}
                href={`/playground/${game.slug}`}
                isComingSoon={game.comingSoon}
                progress={game.progressSupported ? summary?.progressPercentage ?? 0 : undefined}
                completedLevels={summary?.completedLevels ?? 0}
                totalLevels={summary?.totalLevels ?? defaultTotal}
              />
            );
          })}

          <ModeCard
            index={gameCatalog.length}
            title="Elxie Blocks"
            description="Snap code blocks together and program your robot."
            icon="blocks"
            accent="accent"
            href="/playground/blocks"
            locked={!blocks.unlocked}
            lockedHint={`Finish ${blocks.remaining.map((game) => game.title).join(", ")} to unlock`}
          />
        </div>
      </section>
    </div>
  );
}
