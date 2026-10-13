"use client";

import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Lock } from "lucide-react";
import ElxieBlocksFrame from "@/components/games/ElxieBlocksFrame";
import SubPageHeader from "@/components/SubPageHeader";
import { BLOCKS_REQUIRED_GAMES, getBlocksUnlockStatus, isGameCompleted } from "@/lib/blocksUnlock";
import { useProgressSummaries } from "@/lib/useProgressSummaries";

export default function ElxieBlocksPage() {
  const { progress, synced } = useProgressSummaries();
  const { unlocked } = getBlocksUnlockStatus(progress);

  if (unlocked) return <ElxieBlocksFrame />;

  // Local cache says locked; wait for the server copy before showing the lock
  // so a player on a new device doesn't see it flash.
  if (!synced) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <LoaderCircle size={28} className="animate-spin text-white/40" aria-label="Loading" />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <SubPageHeader title="Elxie Blocks" subtitle="Locked" backHref="/playground" />
      <div className="mx-auto min-h-screen max-w-md px-4 pb-10 pt-24">
        <div className="flex flex-col items-center rounded-3xl border border-border bg-surface p-6 text-center shadow-xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 text-accent"><Lock size={30} /></div>
          <h3 className="mt-4 text-xl font-extrabold text-white">Elxie Blocks is locked</h3>
          <p className="mt-2 text-sm leading-6 text-white/50">Finish every level of these games to unlock block coding.</p>
          <ul className="mt-5 w-full space-y-2 text-left">
            {BLOCKS_REQUIRED_GAMES.map((game) => {
              const summary = progress[game.id];
              const done = isGameCompleted(game, summary);
              return (
                <li key={game.id}>
                  <Link href={`/playground/${game.slug}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3.5">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-primary/20 text-primary" : "bg-white/10 text-white/40"}`}>
                      {done ? <Check size={16} /> : <Lock size={14} />}
                    </span>
                    <span className="flex-1 text-sm font-bold text-white">{game.title}</span>
                    <span className="text-xs font-semibold text-white/50">{summary?.completedLevels ?? 0}/{game.levels.length}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/playground" className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3.5 text-sm font-bold text-white"><ArrowLeft size={16} /> Back to games</Link>
        </div>
      </div>
    </main>
  );
}
