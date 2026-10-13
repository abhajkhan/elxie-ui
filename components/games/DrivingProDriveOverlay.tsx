"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowLeft, ArrowRight, Car, LoaderCircle, ShieldCheck, TriangleAlert, X } from "lucide-react";
import ControlPanel from "@/components/ControlPanel";
import type { DrivingProTaskMeta } from "@/types/drivingPro";

type SteerDirection = "left" | "right" | "none";

type DrivingProDriveOverlayProps = {
  task: DrivingProTaskMeta;
  /** "launching" = GO pressed, waiting for the robot to confirm the task. */
  phase: "launching" | "running";
  secondsLeft: number;
  leftTurns: number;
  rightTurns: number;
  totalTurns: number;
  obstacleDetected: boolean;
  onSteer: (direction: SteerDirection) => void;
  onExit: () => void;
};

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Full-screen drive mode shown the instant GO is pressed: timer, live
 * objective, sensor radar and thumb-sized steering pads in one viewport,
 * so the player never has to scroll while the robot is moving.
 */
export default function DrivingProDriveOverlay({
  task,
  phase,
  secondsLeft,
  leftTurns,
  rightTurns,
  totalTurns,
  obstacleDetected,
  onSteer,
  onExit,
}: DrivingProDriveOverlayProps) {
  const isRunning = phase === "running";
  const isEvaluating = isRunning && secondsLeft <= 0;
  const canSteer = isRunning && !isEvaluating;

  const onSteerRef = useRef(onSteer);
  useEffect(() => {
    onSteerRef.current = onSteer;
  }, [onSteer]);

  // Lock page scroll behind the overlay.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Arrow keys steer on desktop.
  useEffect(() => {
    const keyToDirection: Record<string, SteerDirection> = { ArrowLeft: "left", ArrowRight: "right" };
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyToDirection[event.key];
      if (!direction || event.repeat) return;
      event.preventDefault();
      onSteerRef.current(direction);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (keyToDirection[event.key]) onSteerRef.current("none");
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const ringFraction = isRunning ? Math.min(1, Math.max(0, secondsLeft / task.durationSec)) : 1;
  const isLowTime = isRunning && secondsLeft <= 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Task ${task.id} drive mode`}
      className="fixed inset-0 z-[55] flex h-dvh flex-col bg-background pt-safe pb-safe select-none"
    >
      <div className="mx-auto flex h-full w-full max-w-md min-h-0 flex-col gap-3 px-4 pt-4 pb-4">
        {/* HUD: task + countdown ring */}
        <header className="flex shrink-0 items-center gap-3">
          <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
              <circle cx="32" cy="32" r={RING_RADIUS} fill="none" strokeWidth="6" className="stroke-white/10" />
              <circle
                cx="32"
                cy="32"
                r={RING_RADIUS}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringFraction)}
                className={`transition-[stroke-dashoffset] duration-200 ease-linear ${isLowTime ? "stroke-warning" : "stroke-primary"}`}
              />
            </svg>
            <span
              aria-live="polite"
              className={`absolute inset-0 flex items-center justify-center font-mono text-xl font-black ${isLowTime ? "text-warning" : "text-white"}`}
            >
              {isRunning ? secondsLeft : <LoaderCircle size={20} className="animate-spin text-white/60" />}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-primary">
              <Car size={14} /> Task {task.id} of 3
            </p>
            <p className="mt-0.5 truncate text-base font-black text-white">
              {!isRunning ? "Get ready…" : isEvaluating ? "Checking result…" : "Drive!"}
            </p>
            <p className="truncate text-xs text-white/50">{task.title.replace(/^Task \d+:\s*/, "")}</p>
          </div>

          <button
            type="button"
            onClick={onExit}
            aria-label="Exit challenge"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        {/* Live objective */}
        <section className="shrink-0 rounded-2xl border border-white/10 bg-black/30 p-3">
          <p className="text-xs font-semibold leading-snug text-white/80">{task.requirementsText}</p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div
              className={`flex items-center justify-between rounded-xl p-2 ${obstacleDetected ? "bg-danger/15" : "bg-white/5"} ${task.id === 1 ? "col-span-2" : ""}`}
            >
              <span className="text-white/60">Path</span>
              <span className={`flex items-center gap-1 font-bold ${obstacleDetected ? "animate-pulse text-danger" : "text-success"}`}>
                {obstacleDetected ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />}
                {obstacleDetected ? "OBSTACLE!" : "Clear"}
              </span>
            </div>

            {task.id === 2 && (
              <Counter label="Turns" value={totalTurns} target={task.minTurns ?? 4} />
            )}

            {task.id === 3 && (
              <>
                <Counter label="Left" value={leftTurns} target={task.minLeftTurns ?? 2} />
                <Counter label="Right" value={rightTurns} target={task.minRightTurns ?? 3} />
              </>
            )}
          </div>
        </section>

        {/* Sensor radar */}
        <div className="min-h-0 flex-1">
          <ControlPanel mode="challenge" showJoystick={false} showQuickActions={false} />
        </div>

        {/* Steering pads, within thumb reach */}
        <div className="grid shrink-0 grid-cols-2 gap-3">
          <SteerPad direction="left" disabled={!canSteer} onSteer={onSteer} />
          <SteerPad direction="right" disabled={!canSteer} onSteer={onSteer} />
        </div>
        <p className="shrink-0 text-center text-[11px] text-white/40">
          Elxie drives forward by itself. Hold a pad to turn, let go to go straight.
        </p>
      </div>
    </div>
  );
}

function Counter({ label, value, target }: { label: string; value: number; target: number }) {
  const done = value >= target;
  return (
    <div className={`flex items-center justify-between rounded-xl p-2 ${done ? "bg-success/15" : "bg-white/5"}`}>
      <span className="text-white/60">{label}</span>
      <span className={`font-black ${done ? "text-success" : "text-white"}`}>
        {value} / {target}
      </span>
    </div>
  );
}

function SteerPad({
  direction,
  disabled,
  onSteer,
}: {
  direction: "left" | "right";
  disabled: boolean;
  onSteer: (direction: SteerDirection) => void;
}) {
  // Pointer events (not mouse + touch) so one tap is exactly one turn on phones.
  const heldRef = useRef(false);
  const [held, setHeld] = useState(false);

  const release = () => {
    if (!heldRef.current) return;
    heldRef.current = false;
    setHeld(false);
    onSteer("none");
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (disabled || heldRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    heldRef.current = true;
    setHeld(true);
    navigator.vibrate?.(15);
    onSteer(direction);
  };

  // Release a held pad if steering gets disabled mid-press (timer ran out).
  useEffect(() => {
    if (disabled && heldRef.current) {
      heldRef.current = false;
      setHeld(false);
      onSteer("none");
    }
  }, [disabled, onSteer]);

  const Icon = direction === "left" ? ArrowLeft : ArrowRight;

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Steer ${direction}`}
      aria-pressed={held}
      onPointerDown={handlePointerDown}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
      className={`flex h-28 touch-none flex-col items-center justify-center gap-1 rounded-3xl border-2 transition-all duration-75 ${
        disabled
          ? "border-white/10 bg-white/5 text-white/25"
          : held
            ? "scale-95 border-primary bg-primary text-white shadow-[0_0_30px_rgba(124,92,255,0.45)]"
            : "border-primary/50 bg-primary/15 text-primary"
      }`}
    >
      <Icon size={40} strokeWidth={2.6} />
      <span className="text-xs font-black uppercase tracking-wider">{direction}</span>
    </button>
  );
}
