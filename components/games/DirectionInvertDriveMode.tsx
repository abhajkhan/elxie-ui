"use client";

import { useEffect } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Shuffle, X, type LucideIcon } from "lucide-react";
import ControlPanel from "@/components/ControlPanel";
import type { DirectionRule, ObjectiveStatus } from "@/types/directionInvert";

export type LiveObjective = {
  label: string;
  value: string;
  status: ObjectiveStatus;
};

const inputIcons: Record<DirectionRule["playerInput"], LucideIcon> = {
  "Up (Forward)": ArrowUp,
  "Down (Backward)": ArrowDown,
  Left: ArrowLeft,
  Right: ArrowRight,
};

const actionIcons: Record<DirectionRule["robotAction"], LucideIcon> = {
  Forward: ArrowUp,
  Backward: ArrowDown,
  Left: ArrowLeft,
  Right: ArrowRight,
};

/**
 * Joystick → robot mapping as arrow chips; inverted directions are highlighted.
 */
export function DirectionMapping({ rules, compact = false }: { rules: DirectionRule[]; compact?: boolean }) {
  return (
    <ul className={`grid gap-2 ${compact ? "grid-cols-4" : "grid-cols-2"}`} aria-label="Control mapping">
      {rules.map((rule) => {
        const InputIcon = inputIcons[rule.playerInput];
        const ActionIcon = actionIcons[rule.robotAction];
        return (
          <li
            key={rule.playerInput}
            aria-label={`${rule.playerInput} makes the robot go ${rule.robotAction}`}
            className={`flex items-center justify-center gap-1.5 rounded-xl border ${compact ? "py-1.5" : "px-3 py-2"} ${
              rule.isInverted
                ? "border-warning/40 bg-warning/10 text-warning"
                : "border-white/10 bg-white/5 text-white/70"
            }`}
          >
            <InputIcon size={compact ? 16 : 18} strokeWidth={2.6} className="text-white" aria-hidden="true" />
            <span className="text-[10px] font-bold opacity-70" aria-hidden="true">→</span>
            <ActionIcon size={compact ? 16 : 18} strokeWidth={2.6} aria-hidden="true" />
            {!compact && <span className="text-xs font-bold">{rule.robotAction}</span>}
          </li>
        );
      })}
    </ul>
  );
}

type DirectionInvertDriveModeProps = {
  levelId: number;
  concept: string;
  rules: DirectionRule[];
  /** Level 6 only: live mapping mode from firmware ("syncing" until the first update). */
  dynamicMode?: "full_invert" | "normal" | "syncing";
  objectives: LiveObjective[];
  onAbort: () => void;
};

/**
 * Full-screen play view: live objectives, the active control mapping and the
 * full ControlPanel (sensors + joystick) in one viewport, so the player never
 * scrolls while driving.
 */
export default function DirectionInvertDriveMode({
  levelId,
  concept,
  rules,
  dynamicMode,
  objectives,
  onAbort,
}: DirectionInvertDriveModeProps) {
  // Lock page scroll behind the overlay.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Direction Invert level ${levelId}`}
      className="fixed inset-0 z-[55] flex h-dvh flex-col bg-background pt-safe pb-safe"
    >
      <div className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col gap-2.5 px-4 pt-3 pb-3">
        {/* HUD */}
        <header className="flex shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Shuffle size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Level {levelId} of 6</p>
            <p className="truncate text-sm font-black text-white">{concept}</p>
          </div>
          {dynamicMode && (
            <span
              aria-live="polite"
              className={`shrink-0 rounded-xl border px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ${
                dynamicMode === "full_invert"
                  ? "animate-pulse border-danger/40 bg-danger/20 text-danger"
                  : dynamicMode === "normal"
                    ? "border-success/40 bg-success/15 text-success"
                    : "border-white/20 bg-white/10 text-white/60"
              }`}
            >
              {dynamicMode === "full_invert" ? "Inverted" : dynamicMode === "normal" ? "Normal" : "Syncing…"}
            </span>
          )}
          <button
            type="button"
            onClick={onAbort}
            aria-label="Abort level"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-danger transition hover:bg-danger/20"
          >
            <X size={18} />
          </button>
        </header>

        {/* Live objectives */}
        <ul className="grid shrink-0 grid-cols-4 gap-2" aria-label="Objective progress">
          {objectives.map((objective) => (
            <li
              key={objective.label}
              className={`flex flex-col items-center rounded-xl border px-1 py-1.5 text-center transition-colors ${
                objective.status === "failed"
                  ? "border-danger/50 bg-danger/15 text-danger"
                  : objective.status === "passed"
                    ? "border-success/50 bg-success/15 text-success"
                    : "border-white/10 bg-black/30 text-white"
              }`}
            >
              <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50">
                {objective.status === "passed" && <Check size={10} strokeWidth={3} className="text-success" />}
                {objective.label}
              </span>
              <span className="font-mono text-sm font-black">{objective.value}</span>
            </li>
          ))}
        </ul>

        {/* Active mapping: the thing to remember while driving */}
        <DirectionMapping rules={rules} compact />

        {/* Full control panel: sensors, quick actions and joystick */}
        <div className="min-h-0 flex-1">
          <ControlPanel mode="challenge" compact />
        </div>
      </div>
    </div>
  );
}
