"use client";

import { useEffect, useRef, useState } from "react";

import {
  Bot,
  Compass,
  Gauge,
  Palette,
  TriangleAlert,
  Volume2,
} from "lucide-react";

const PerformanceModeIcon = ({ size = 24, className = "" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Tachometer / Gauge Outer Arch */}
    <path d="M3 14A9 9 0 0 1 19.5 7.5" />

    {/* Gauge Needle pointing towards high performance (top-right) */}
    <line x1="12" y1="14" x2="17" y2="9" />
    <circle cx="12" cy="14" r="1" fill="currentColor" />

    {/* Lightning bolt inside the gauge */}
    <path d="M11 14h3l-3.5 5.5v-3.5H8l3.5-5.5v3.5Z" />
  </svg>
);

import JoystickController, {
  type JoystickDirection,
} from "@/components/JoystickController";
import ColorWheelModal from "@/components/ColorWheelModal";

import { useBleContext } from "@/context/BleContext";
import { JoyStickDir } from "@/types/protocol";

type ControlPanelMode = "free-ride" | "training" | "challenge";

type ControlPanelProps = {
  mode?: ControlPanelMode;
  onInputDirection?: (dir: "up" | "right" | "down" | "left") => void;
  customTelemetry?: React.ReactNode;
  customControls?: React.ReactNode;
  showJoystick?: boolean;
  /** LED / Honk / Performance buttons. Hide during timed tasks to keep focus on driving. */
  showQuickActions?: boolean;
  /**
   * Full-screen game layouts: no header, sensors sized to content in a tighter
   * radar, and all remaining height goes to the joystick.
   */
  compact?: boolean;
};

type ObstacleIndicatorProps = {
  label: string;
  detected: boolean | null;
};

type AlertToast = {
  id: number;
  message: string;
  tone: "warning" | "danger";
};

const AXIS_SWITCH_MARGIN = 1.2;

const modeLabel: Record<ControlPanelMode, string> = {
  "free-ride": "Free ride",
  training: "Training",
  challenge: "Challenge",
};

function ObstacleIndicator({
  label,
  detected,
}: ObstacleIndicatorProps) {
  const stateLabel =
    detected === null
      ? "Waiting"
      : detected
        ? "Obstacle"
        : "Clear";

  const hasObstacle = detected === true;

  const stateClass =
    detected === null
      ? "border-white/15 bg-white/5 text-white/45"
      : detected
        ? "border-danger bg-danger text-white"
        : "border-success/50 bg-success/15 text-success";

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full transition-all ${
        hasObstacle
          ? "border border-danger bg-danger/20 px-2 py-1 text-danger shadow-[0_0_16px_rgba(255,76,100,0.6)]"
          : "border border-white/10 bg-white/5 px-2 py-1"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full border ${
          hasObstacle ? "animate-pulse shadow-[0_0_8px_currentColor]" : ""
        } ${stateClass}`}
      />

      <span className="text-[10px] font-bold uppercase tracking-wider text-white/70">
        {label}
      </span>

      {hasObstacle && (
        <span className="flex items-center gap-0.5 text-[9px] font-black uppercase tracking-wider text-danger">
          <TriangleAlert size={11} aria-hidden="true" />
          Alert
        </span>
      )}

      <span className="sr-only">{stateLabel}</span>
    </div>
  );
}

export default function ControlPanel({
  mode = "free-ride",
  onInputDirection,
  customTelemetry,
  customControls,
  showJoystick = true,
  showQuickActions = true,
  compact = false,
}: ControlPanelProps) {
  const { status, telemetry, robotState, sendJoystickInput, setLedColor: sendLedColor, honk } = useBleContext();

  const [colorWheelOpen, setColorWheelOpen] = useState(false);
  const [ledColor, setLedColor] = useState<{ r: number; g: number; b: number } | null>(null);
  const [alertToast, setAlertToast] = useState<AlertToast | null>(null);
  const [performanceMode, setPerformanceMode] = useState(false);

  const previousAlerts = useRef({
    sudden: false,
    pit: false,
  });

  const activeMovementDirection = useRef<JoyStickDir | null>(null);

  const isConnected = status === "connected";
  const isRobotInGame = robotState === "GAME" || telemetry?.state === "GAME";

  const heading = telemetry?.direction ?? null;
  const obstacle = telemetry?.obstacle;

  useEffect(() => {
    const sudden = telemetry?.motion.sudden ?? false;
    const pit = telemetry?.pit.detected ?? false;

    if (sudden && !previousAlerts.current.sudden) {
      setAlertToast({
        id: Date.now(),
        message: "Sudden motion detected",
        tone: "warning",
      });
    } else if (pit && !previousAlerts.current.pit) {
      setAlertToast({
        id: Date.now(),
        message: "Pit detected ahead",
        tone: "danger",
      });
    }

    previousAlerts.current = { sudden, pit };
  }, [telemetry?.motion.sudden, telemetry?.pit.detected]);

  useEffect(() => {
    if (!alertToast) return;

    const timeoutId = window.setTimeout(() => {
      setAlertToast((current) =>
        current?.id === alertToast.id ? null : current,
      );
    }, 3_000);

    return () => window.clearTimeout(timeoutId);
  }, [alertToast]);

  const handleJoystickDirection = ({ dx, dy }: JoystickDirection) => {
    if (!isConnected) return;

    const magnitude = performanceMode ? 0.9 : 0.6;

    if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08) {
      if (activeMovementDirection.current !== null) {
        activeMovementDirection.current = null;
        void sendJoystickInput("none", isRobotInGame ? undefined : 0).catch((error: unknown) => {
          console.error("[CONTROL PANEL] Joystick stop command failed", error);
        });
      }
      return;
    }

    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const current = activeMovementDirection.current;
    const currentAxisIsVertical = current === "up" || current === "down";
    const currentAxisIsHorizontal = current === "right" || current === "left";

    let useVerticalAxis: boolean;
    if (currentAxisIsVertical) {
      useVerticalAxis = absDy * AXIS_SWITCH_MARGIN >= absDx;
    } else if (currentAxisIsHorizontal) {
      useVerticalAxis = absDy > absDx * AXIS_SWITCH_MARGIN;
    } else {
      useVerticalAxis = absDy >= absDx;
    }

    const nextDirection: JoyStickDir = useVerticalAxis
      ? dy > 0
        ? "up"
        : "down"
      : dx > 0
        ? "right"
        : "left";

    if (activeMovementDirection.current === nextDirection) {
      return;
    }

    activeMovementDirection.current = nextDirection;
    const inputDirection = nextDirection;

    void sendJoystickInput(nextDirection, isRobotInGame ? undefined : magnitude).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Joystick input command failed", error);
    });
    onInputDirection?.(inputDirection);
  };

  const handleJoystickRelease = () => {
    if (activeMovementDirection.current === null || !isConnected) return;

    activeMovementDirection.current = null;
    void sendJoystickInput("none", isRobotInGame ? undefined : 0).catch((error: unknown) => {
      console.error("[CONTROL PANEL] Joystick release stop failed", error);
    });
  };

  const sendRgb = (r: number, g: number, b: number) => {
    setLedColor({ r, g, b });
    void sendLedColor(r, g, b).catch((error: unknown) => {
      console.error("[CONTROL PANEL] LED command failed", error);
    });
  };

  const togglePerfomanceMode = () => {
    setPerformanceMode((active) => !active);
  };

  const sendHonk = () => {
    void honk().catch((error: unknown) => {
      console.error("[CONTROL PANEL] Honk command failed", error);
    });
  };

  const ledHex = ledColor
    ? `#${[ledColor.r, ledColor.g, ledColor.b]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")}`
    : null;

  return (
    <section
      aria-label={`${modeLabel[mode]} robot controls`}
      className={`relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-[0_24px_80px_rgba(0,0,0,0.22)] ${compact ? "p-3" : "p-4 sm:p-5"}`}
    >
      {/* Header */}
      {!compact && (
      <div className="flex items-start justify-between gap-3 shrink-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            ELXIE Control
          </p>
        </div>

        <div
          className={`rounded-full border px-3 py-1.5 text-xs font-bold ${isConnected
            ? "border-success/30 bg-success/10 text-success"
            : "border-white/10 bg-white/5 text-white/45"
            }`}
        >
          {isConnected
            ? "Live"
            : status === "connecting"
              ? "Connecting"
              : "Offline"}
        </div>
      </div>
      )}

      {/* Main Content Area: takes the space the joystick leaves, but never
          shrinks below its content (default min-height: auto), so sensors can't
          overlap the quick-action buttons. */}
      <div className={compact ? "flex flex-1 flex-col gap-2" : "mt-3 flex flex-1 flex-col gap-3"}>
        {customTelemetry ? (
          <div className="flex-1 overflow-hidden">{customTelemetry}</div>
        ) : (
          <div
            className={
              compact
                ? "flex flex-1 flex-col justify-center gap-2 rounded-2xl border border-border bg-black/20 p-2.5"
                : "flex flex-1 flex-col justify-between rounded-3xl border border-border bg-black/20 p-3.5 sm:p-4"
            }
          >
            {/* Heading Display (compact: shares the row with front distance) */}
            <div className="flex shrink-0 items-center justify-between text-xs text-white/45">
              <span className="flex items-center gap-1.5">
                <Compass size={14} className="text-accent" />
                Heading
              </span>

              <strong className="font-mono text-sm text-white">
                {heading === null ? "--°" : `${Math.round(heading)}°`}
              </strong>

              {compact && (
                <span className="ml-auto flex items-center gap-1.5 pl-3">
                  <Gauge size={14} className="text-accent" />
                  Front
                  <strong className="font-mono text-sm text-white">
                    {telemetry?.distance.front === undefined ||
                  telemetry.distance.front === null
                  ? "-- cm"
                  : `${telemetry.distance.front} cm`}
                  </strong>
                </span>
              )}
            </div>

            {/* Radar / Sensor Display Area with Spaced Non-Overlapping Obstacles */}
            <div
              className={
                compact
                  ? "relative flex w-full flex-col items-center gap-1"
                  : "relative my-auto flex w-full flex-col items-center justify-between py-2 min-h-[150px]"
              }
            >
              {/* Top Row: FL, FRONT Label, FR */}
              <div className="flex w-full items-center justify-between px-1">
                <ObstacleIndicator
                  label="FL"
                  detected={obstacle?.frontLeft ?? null}
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Front
                </span>
                <ObstacleIndicator
                  label="FR"
                  detected={obstacle?.frontRight ?? null}
                />
              </div>

              {/* Center Robot Diagram */}
              <div className={`flex items-center justify-center ${compact ? "" : "my-2"}`}>
                <div
                  aria-label={
                    heading === null
                      ? "Robot heading unavailable"
                      : `Robot heading ${Math.round(heading)} degrees`
                  }
                  className={`relative flex items-center justify-center rounded-2xl border ${compact ? "h-11 w-11" : "h-14 w-14"} border-primary/50 bg-primary/10 shadow-[0_0_35px_rgba(124,92,255,0.25)] transition-transform duration-500`}
                  style={{
                    transform: `rotate(${heading ?? 0}deg)`,
                  }}
                >
                  <div className="absolute top-1.5 h-0 w-0 border-x-[6px] border-x-transparent border-b-[8px] border-b-accent" />
                  <Bot size={compact ? 22 : 26} strokeWidth={1.65} className="text-primary" />
                </div>
              </div>

              {/* Bottom Row: RL, REAR Label, RR */}
              <div className="flex w-full items-center justify-between px-1">
                <ObstacleIndicator
                  label="RL"
                  detected={obstacle?.rearLeft ?? null}
                />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Rear
                </span>
                <ObstacleIndicator
                  label="RR"
                  detected={obstacle?.rearRight ?? null}
                />
              </div>
            </div>

            {/* Distance Reading */}
            {!compact && (
            <div className="flex shrink-0 items-center justify-center gap-2 text-center pt-1">
              <Gauge size={16} className="text-accent" />
              <span className="text-sm text-white/55">Front distance</span>
              <strong className="font-mono text-lg text-white">
                {telemetry?.distance.front === undefined ||
                  telemetry.distance.front === null
                  ? "-- cm"
                  : `${telemetry.distance.front} cm`}
              </strong>
            </div>
            )}
          </div>
        )}

        {/* Quick Action Buttons */}
        {showQuickActions && (
        <div className="flex w-full shrink-0 justify-between gap-2">
          <button
            type="button"
            onClick={() => setColorWheelOpen(true)}
            aria-label="Set LED Color"
            className="flex h-13 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-black/20 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <div
              className="flex h-4.5 w-4.5 items-center justify-center rounded-full border border-white/20 shadow-inner"
              style={{
                background: ledHex ?? "transparent",
                boxShadow: ledHex ? `0 0 10px ${ledHex}88` : "none",
              }}
            >
              <Palette
                size={11}
                className={ledHex ? "mix-blend-difference text-white/90" : ""}
              />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider">
              LED
            </span>
          </button>

          <button
            type="button"
            onClick={sendHonk}
            aria-label="Honk"
            className="flex h-13 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border border-border bg-black/20 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <Volume2 size={16} />
            <span className="text-[9px] font-bold uppercase tracking-wider">
              Honk
            </span>
          </button>

          <button
            type="button"
            onClick={togglePerfomanceMode}
            aria-label="Performance mode"
            aria-pressed={performanceMode}
            className={`flex h-13 flex-1 flex-col items-center justify-center gap-1 rounded-2xl border transition ${performanceMode ? "border-primary bg-primary/15 text-primary" : "border-border bg-black/20 text-white/50 hover:bg-white/10 hover:text-white"}`}
          >
            <PerformanceModeIcon size={18} />
            <span className="text-[9px] font-bold uppercase tracking-wider">
              Perf {performanceMode ? "On" : "Off"}
            </span>
          </button>
        </div>
        )}
      </div>

      {/* Alert Toasts: anchored to this panel, just below its header */}
      {alertToast && (
        <div
          className={`pointer-events-none absolute inset-x-4 z-20 flex justify-center ${compact ? "top-3" : "top-14"}`}
          role="alert"
        >
          <p
            className={`flex max-w-full items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur ${alertToast.tone === "warning"
              ? "border-warning/35 bg-warning/90 text-black"
              : "border-danger/35 bg-danger/90 text-white"
              }`}
          >
            <TriangleAlert size={18} />
            {alertToast.message}
          </p>
        </div>
      )}

      {/* Joystick Area */}
      {(customControls || showJoystick) && (
      <div
        className={`flex flex-col ${compact ? "mt-2" : "mt-3"} ${
          // Capped joystick: ~30% of the screen, shrinking to 8.5rem when space is tight.
          showJoystick ? "h-[clamp(9.5rem,30dvh,15rem)] min-h-[8.5rem] shrink" : "shrink-0"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {customControls && (
            <div className="my-2 z-10 w-full shrink-0">{customControls}</div>
          )}

          {showJoystick && (
            <div className="mx-auto mt-1 flex min-h-0 flex-1 w-full flex-col justify-center">
              <JoystickController
                disabled={!isConnected}
                onDirectionChange={handleJoystickDirection}
                onRelease={handleJoystickRelease}
              />
            </div>
          )}
        </div>
      </div>
      )}

      {colorWheelOpen && (
        <ColorWheelModal
          onClose={() => setColorWheelOpen(false)}
          sendRgb={sendRgb}
        />
      )}
    </section>
  );
}
