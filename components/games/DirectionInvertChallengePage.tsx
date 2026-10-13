"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Play,
  Bluetooth,
  Shuffle,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import ControlPanel from "@/components/ControlPanel";
import { useBleContext } from "@/context/BleContext";
import {
  calculateStars,
  getLevelConfig,
  type LevelThresholds,
  isLevelUnlocked,
} from "@/lib/directionInvert";
import {
  fetchAndSyncProgress,
  readLocalProgress,
  writeLocalProgress,
  submitAndPersistLevelResult,
} from "@/lib/progressStore";
import type {
  DirectionInvertGameState,
  DirectionInvertLiveProgress,
  ObjectiveStatus,
} from "@/types/directionInvert";
import type { LevelProgress } from "@/types/colourQuest";
import type { GameResultPayload } from "@/types/protocol";
import { useGameSession } from "@/games/useGameSession";

export default function DirectionInvertChallengePage() {
  const params = useParams<{ mode: string; level: string }>();
  const router = useRouter();
  const currentLevelId = Math.max(1, parseInt(params.level || "1", 10));

  const levelConfig = getLevelConfig(currentLevelId);

  const {
    status: bleStatus,
    gameState: serverGameState,
    lastMessage,
    openModal: openBleModal,
    stop,
  } = useBleContext();

  const [gameStateMode, setGameStateMode] =
    useState<DirectionInvertGameState>("INSTRUCTIONS");

  // Live objective thresholds received directly from firmware game_started response
  const [liveThresholds, setLiveThresholds] = useState<LevelThresholds | null>(null);

  // Live real-time objective progress telemetry from firmware (e.g. game_feedback / game_state)
  const [liveProgress, setLiveProgress] = useState<DirectionInvertLiveProgress | null>(null);

  const [objectiveStatuses, setObjectiveStatuses] = useState<
    Record<1 | 2 | 3, ObjectiveStatus>
  >({
    1: "pending",
    2: "pending",
    3: "pending",
  });

function isValidTargets(targets: unknown): targets is LevelThresholds {
  if (!targets || typeof targets !== "object") return false;
  const t = targets as Record<string, unknown>;
  return (
    typeof t.safeDriveTargetSec === "number" &&
    Number.isFinite(t.safeDriveTargetSec) &&
    t.safeDriveTargetSec > 0 &&
    typeof t.minTotalTurns === "number" &&
    Number.isInteger(t.minTotalTurns) &&
    t.minTotalTurns > 0 &&
    typeof t.minLeftTurns === "number" &&
    Number.isInteger(t.minLeftTurns) &&
    t.minLeftTurns >= 0 &&
    typeof t.minRightTurns === "number" &&
    Number.isInteger(t.minRightTurns) &&
    t.minRightTurns >= 0
  );
}

function parseLiveProgress(data: unknown): DirectionInvertLiveProgress | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  const p = (obj.progress && typeof obj.progress === "object" ? obj.progress : obj) as Record<string, unknown>;

  if (
    typeof p.safeDriveElapsedSec === "number" &&
    typeof p.totalTurns === "number" &&
    typeof p.leftTurns === "number" &&
    typeof p.rightTurns === "number"
  ) {
    const rawMode = p.controlMode ?? obj.controlMode;
    const controlMode =
      rawMode === "full_invert" || rawMode === "normal"
        ? (rawMode as "full_invert" | "normal")
        : undefined;

    return {
      safeDriveElapsedSec: p.safeDriveElapsedSec,
      safeDriveTargetSec: typeof p.safeDriveTargetSec === "number" ? p.safeDriveTargetSec : undefined,
      totalTurns: p.totalTurns,
      minTotalTurns: typeof p.minTotalTurns === "number" ? p.minTotalTurns : undefined,
      leftTurns: p.leftTurns,
      minLeftTurns: typeof p.minLeftTurns === "number" ? p.minLeftTurns : undefined,
      rightTurns: p.rightTurns,
      minRightTurns: typeof p.minRightTurns === "number" ? p.minRightTurns : undefined,
      controlMode,
    };
  }
  return null;
}

function sanitizeProgress(
  map: Record<number, LevelProgress>,
  syncToStorage = false,
): Record<number, LevelProgress> {
  let migrated = false;
  const sanitized: Record<number, LevelProgress> = {};
  for (const [key, val] of Object.entries(map)) {
    const lvl = Number(key);
    const normalizedBest =
      val.bestScore > 1.0
        ? val.bestScore <= 3
          ? Number((val.bestScore / 3).toFixed(2))
          : Number((val.bestScore / 100).toFixed(2))
        : val.bestScore;

    if (normalizedBest !== val.bestScore) {
      migrated = true;
    }

    sanitized[lvl] = {
      ...val,
      bestScore: normalizedBest,
    };
  }

  if (migrated && syncToStorage && typeof window !== "undefined") {
    writeLocalProgress("inverted-drive", sanitized);
  }

  return sanitized;
}

  const [finalResult, setFinalResult] = useState<{
    score: number;
    stars: 0 | 1 | 2 | 3;
  } | null>(null);

  const [levelProgressMap, setLevelProgressMap] = useState<
    Record<number, LevelProgress>
  >(() => {
    if (typeof window === "undefined") return {};
    return sanitizeProgress(readLocalProgress("inverted-drive"), true);
  });

  const isUnlocked = isLevelUnlocked(currentLevelId, levelProgressMap, 6);
  const resultHandledRef = useRef(false);

  // Clear live targets and progress when switching level
  useEffect(() => {
    setLiveThresholds(null);
    setLiveProgress(null);
  }, [currentLevelId]);

  // Sync progress with backend in background
  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      try {
        const prog = await fetchAndSyncProgress("inverted-drive");
        if (mounted && prog && prog.levels) {
          setLevelProgressMap(sanitizeProgress(prog.levels, true));
        }
      } catch (err) {
        console.warn("[DIRECTION INVERT] Failed to sync progress:", err);
      }
    }
    void loadProgress();
    return () => {
      mounted = false;
    };
  }, [currentLevelId]);

  // Handle game result from firmware
  const handleResult = useCallback(
    async (res: GameResultPayload) => {
      if (resultHandledRef.current) return;
      resultHandledRef.current = true;

      // Inverted Drive has 3 objectives. Firmware sends passedCount (0-3).
      // Normalize score to 0.0 - 1.0 range for storage and display.
      const rawScore = res.score;
      const normalizedScore =
        rawScore > 1
          ? (rawScore <= 3 ? rawScore / 3 : rawScore / 100)
          : rawScore;
      const computedStars = res.stars ?? calculateStars(normalizedScore);

      setFinalResult({
        score: normalizedScore,
        stars: computedStars,
      });

      try {
        const persistRes = await submitAndPersistLevelResult(
          "inverted-drive",
          currentLevelId,
          normalizedScore,
          computedStars,
        );
        if (persistRes?.levels) {
          setLevelProgressMap(sanitizeProgress(persistRes.levels));
        }
      } catch (err) {
        console.warn("[DIRECTION INVERT] Failed to persist level result:", err);
      }

      setGameStateMode("RESULT");
    },
    [currentLevelId],
  );

  const gameSession = useGameSession({
    game: "inverted_drive",
    level: currentLevelId,
    onResult: handleResult,
  });

  // Sync session state to UI mode
  useEffect(() => {
    if (gameSession.status === "playing") {
      setGameStateMode("RUNNING");
    } else if (gameSession.status === "idle" && gameStateMode === "RUNNING") {
      setGameStateMode("INSTRUCTIONS");
    }
  }, [gameSession.status, gameStateMode]);

  // Listen for per-objective game_state messages from firmware
  useEffect(() => {
    if (
      serverGameState &&
      serverGameState.game === "inverted_drive" &&
      (serverGameState.level === undefined || serverGameState.level === currentLevelId)
    ) {
      if (serverGameState.task) {
        const taskId = serverGameState.task as 1 | 2 | 3;
        const newStatus: ObjectiveStatus =
          serverGameState.status === "passed"
            ? "passed"
            : serverGameState.status === "failed"
            ? "failed"
            : "pending";
        setObjectiveStatuses((prev) => ({
          ...prev,
          [taskId]: newStatus,
        }));
      }
    }
  }, [serverGameState, currentLevelId]);

  // Synchronize live objective thresholds from authoritative firmware game_started response
  useEffect(() => {
    if (
      lastMessage &&
      lastMessage.type === "response" &&
      lastMessage.response === "game_started"
    ) {
      const payload = lastMessage.payload;
      if (
        payload &&
        payload.gameId === "inverted_drive" &&
        (payload.level === undefined || payload.level === currentLevelId) &&
        isValidTargets(payload.targets)
      ) {
        setLiveThresholds(payload.targets);
      }
    }
  }, [lastMessage, currentLevelId]);

  // Synchronize live objective counters from firmware telemetry, feedback, or game_state
  useEffect(() => {
    if (!lastMessage) return;

    // 1. game_feedback response carrying live progress payload
    if (
      lastMessage.type === "response" &&
      lastMessage.response === "game_feedback"
    ) {
      const msg = lastMessage as Record<string, unknown>;
      const gameId = msg.gameId ?? (msg.payload as Record<string, unknown> | undefined)?.gameId;
      const lvl = msg.level ?? (msg.payload as Record<string, unknown> | undefined)?.level;
      if (
        gameId === "inverted_drive" &&
        (lvl === undefined || lvl === currentLevelId)
      ) {
        const parsed = parseLiveProgress(msg.payload ?? msg);
        if (parsed) {
          setLiveProgress(parsed);
          if (parsed.safeDriveTargetSec && parsed.minTotalTurns) {
            setLiveThresholds((prev) => prev ?? {
              safeDriveTargetSec: parsed.safeDriveTargetSec!,
              minTotalTurns: parsed.minTotalTurns!,
              minLeftTurns: parsed.minLeftTurns ?? 0,
              minRightTurns: parsed.minRightTurns ?? 0,
            });
          }
        }
      }
    }

    // 2. game_state or telemetry messages with progress payload
    if (
      lastMessage.type === "game_state" ||
      lastMessage.type === "telemetry"
    ) {
      const msg = lastMessage as Record<string, unknown>;
      const payload = (msg.payload ?? msg) as Record<string, unknown>;
      const game = payload.game ?? payload.gameId;
      const lvl = payload.level;
      if (
        game === "inverted_drive" &&
        (lvl === undefined || lvl === currentLevelId)
      ) {
        const parsed = parseLiveProgress(payload);
        if (parsed) {
          setLiveProgress(parsed);
        }
      }
    }
  }, [lastMessage, currentLevelId]);

  useEffect(() => {
    if (
      lastMessage &&
      lastMessage.type === "game_state" &&
      lastMessage.payload.game === "inverted_drive"
    ) {
      const { task, status } = lastMessage.payload;
      if (task) {
        const taskId = task as 1 | 2 | 3;
        const newStatus: ObjectiveStatus =
          status === "passed"
            ? "passed"
            : status === "failed"
            ? "failed"
            : "pending";
        setObjectiveStatuses((prev) => ({
          ...prev,
          [taskId]: newStatus,
        }));
      }
    }
  }, [lastMessage]);

  const handleStartMission = async () => {
    if (bleStatus !== "connected") {
      openBleModal();
      return;
    }
    resultHandledRef.current = false;
    setLiveThresholds(null);
    setLiveProgress(null);
    setObjectiveStatuses({ 1: "pending", 2: "pending", 3: "pending" });
    setFinalResult(null);
    await gameSession.start();
  };

  const handleAbortMission = async () => {
    resultHandledRef.current = false;
    setLiveThresholds(null);
    setLiveProgress(null);
    await stop();
    await gameSession.abort();
    setGameStateMode("INSTRUCTIONS");
  };

  const handleNextLevel = () => {
    resultHandledRef.current = false;
    setLiveThresholds(null);
    setLiveProgress(null);
    if (currentLevelId < 6) {
      router.push(`/playground/inverted-drive/challenges/${currentLevelId + 1}`);
      setGameStateMode("INSTRUCTIONS");
      setObjectiveStatuses({ 1: "pending", 2: "pending", 3: "pending" });
      setFinalResult(null);
    } else {
      router.push("/playground/inverted-drive/challenges");
    }
  };

  const handleRetryLevel = async () => {
    resultHandledRef.current = false;
    setLiveThresholds(null);
    setLiveProgress(null);
    setGameStateMode("INSTRUCTIONS");
    setObjectiveStatuses({ 1: "pending", 2: "pending", 3: "pending" });
    setFinalResult(null);
    await handleStartMission();
  };

  if (!isUnlocked) {
    return (
      <main className="min-h-screen bg-background pb-12 pt-20">
        <SubPageHeader
          title={`Direction Invert · Level ${currentLevelId}`}
          subtitle="Level Locked"
          backHref="/playground/inverted-drive/challenges"
        />
        <div className="mx-auto max-w-md px-4 pt-10 text-center">
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 shadow-xl">
            <ShieldAlert size={48} className="mx-auto text-amber-400" />
            <h2 className="mt-4 text-xl font-bold text-white">Level Locked</h2>
            <p className="mt-2 text-sm text-white/70">
              Earn 3 stars on Level {currentLevelId - 1} to unlock this level!
            </p>
            <button
              onClick={() =>
                router.push(
                  `/playground/inverted-drive/challenges/${currentLevelId - 1}`,
                )
              }
              className="mt-6 w-full rounded-2xl bg-amber-500 py-3.5 font-bold text-black transition active:scale-95"
            >
              Go to Level {currentLevelId - 1}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background pb-12 pt-20">
      <SubPageHeader
        title={`Direction Invert · Level ${currentLevelId}`}
        subtitle={levelConfig.title}
        backHref="/playground/inverted-drive/challenges"
      />

      <div className="mx-auto max-w-lg px-4 pt-4">
        {/* BLE Banner standard check */}
        {bleStatus !== "connected" && (
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
            <div className="flex items-center gap-3">
              <Bluetooth className="h-5 w-5 animate-pulse text-amber-400" />
              <span className="text-xs font-semibold">
                Robot Not Connected over BLE
              </span>
            </div>
            <button
              onClick={openBleModal}
              className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-black"
            >
              Connect
            </button>
          </div>
        )}

        {/* INSTRUCTIONS SCREEN */}
        {gameStateMode === "INSTRUCTIONS" && (
          <div className="space-y-4">
            {/* Level Card & Concept */}
            <div className="rounded-3xl border border-border bg-surface p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {levelConfig.concept}
                </span>
                <span className="text-xs font-semibold text-white/50">
                  Level {currentLevelId} of 6
                </span>
              </div>
              <h2 className="mt-3 text-2xl font-black text-white">
                {levelConfig.title}
              </h2>

              {/* Control Inversion Mapping Rules Card */}
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center gap-2 font-bold text-white">
                  <Shuffle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Active Inversion Mapping</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {levelConfig.rules.map((rule, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-xl p-2.5 border ${
                        rule.isInverted
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                          : "border-white/10 bg-white/5 text-white/80"
                      }`}
                    >
                      <span className="font-semibold">{rule.playerInput}</span>
                      <span className="font-mono text-white">→ {rule.robotAction}</span>
                    </div>
                  ))}
                </div>
                {levelConfig.inversionType === "dynamic" && (
                  <p className="mt-2 text-[11px] text-amber-300/80">
                    ⚡ Control mapping shifts dynamically during play (Normal ↔ Full Invert)!
                  </p>
                )}
              </div>

              {/* Objectives List */}
              <div className="mt-5 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white/60">
                  Level Objectives (3 Stars Available)
                </h3>
                {levelConfig.objectives.map((obj) => (
                  <div
                    key={obj.id}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-xs font-black text-primary">
                      {obj.id}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">{obj.title}</p>
                      <p className="text-[11px] text-white/60">
                        {obj.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Start GO Button */}
              <button
                onClick={handleStartMission}
                className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primary py-4 text-base font-black text-black shadow-lg shadow-primary/25 transition active:scale-95"
              >
                <Play className="h-5 w-5 fill-current" />
                Start Level {currentLevelId}
              </button>
            </div>
          </div>
        )}

        {/* RUNNING SCREEN */}
        {gameStateMode === "RUNNING" && (
          <div className="space-y-4">
            {/* Live Inversion Rule Header Banner */}
            <div className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/10 p-3.5 text-primary">
              <div className="flex items-center gap-2">
                <Shuffle className="h-5 w-5 animate-spin" />
                <div>
                  <span className="block text-xs font-extrabold uppercase tracking-wider text-white">
                    {levelConfig.concept}
                  </span>
                  <span className="text-[11px] text-primary/80">
                    Robot applies active directional mapping
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {currentLevelId === 6 && (
                  <div
                    className={`rounded-xl border px-2.5 py-1 text-xs font-black tracking-wide uppercase transition-colors ${
                      liveProgress?.controlMode === "full_invert"
                        ? "border-rose-500/40 bg-rose-500/20 text-rose-300 animate-pulse"
                        : liveProgress?.controlMode === "normal"
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                        : "border-white/20 bg-white/10 text-white/60"
                    }`}
                  >
                    {liveProgress?.controlMode === "full_invert"
                      ? "Full Invert"
                      : liveProgress?.controlMode === "normal"
                      ? "Normal Control"
                      : "Mode Syncing..."}
                  </div>
                )}
                <button
                  onClick={handleAbortMission}
                  className="rounded-xl border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300"
                >
                  Abort
                </button>
              </div>
            </div>

            {/* Objectives Live Status */}
            {(() => {
              const safeDriveTarget = liveProgress?.safeDriveTargetSec ?? liveThresholds?.safeDriveTargetSec;
              const safeDrivePassed =
                objectiveStatuses[1] === "passed" ||
                (liveProgress !== null &&
                  safeDriveTarget !== undefined &&
                  safeDriveTarget > 0 &&
                  liveProgress.safeDriveElapsedSec >= safeDriveTarget);
              const safeDriveFailed = objectiveStatuses[1] === "failed";

              const totalTurnsTarget = liveProgress?.minTotalTurns ?? liveThresholds?.minTotalTurns;
              const totalTurnsPassed =
                objectiveStatuses[2] === "passed" ||
                (liveProgress !== null &&
                  totalTurnsTarget !== undefined &&
                  totalTurnsTarget > 0 &&
                  liveProgress.totalTurns >= totalTurnsTarget);
              const totalTurnsFailed = objectiveStatuses[2] === "failed";

              const rightTurnsTarget = liveProgress?.minRightTurns ?? liveThresholds?.minRightTurns;
              const rightTurnsPassed =
                (objectiveStatuses[3] === "passed" && (!rightTurnsTarget || (liveProgress ? liveProgress.rightTurns >= rightTurnsTarget : true))) ||
                (liveProgress !== null &&
                  rightTurnsTarget !== undefined &&
                  rightTurnsTarget > 0 &&
                  liveProgress.rightTurns >= rightTurnsTarget);
              const rightTurnsFailed = objectiveStatuses[3] === "failed";

              const leftTurnsTarget = liveProgress?.minLeftTurns ?? liveThresholds?.minLeftTurns;
              const leftTurnsPassed =
                (objectiveStatuses[3] === "passed" && (!leftTurnsTarget || (liveProgress ? liveProgress.leftTurns >= leftTurnsTarget : true))) ||
                (liveProgress !== null &&
                  leftTurnsTarget !== undefined &&
                  leftTurnsTarget > 0 &&
                  liveProgress.leftTurns >= leftTurnsTarget);
              const leftTurnsFailed = objectiveStatuses[3] === "failed";

              return (
                <div className="rounded-2xl border border-white/10 bg-surface p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                    Live Objective Progress
                  </span>
                  <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {/* 1. Safe Drive (Task 1) */}
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-colors ${
                        safeDriveFailed
                          ? "border-rose-500/50 bg-rose-950/40 text-rose-300"
                          : safeDrivePassed
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-400"
                          : "border-white/10 bg-black/40 text-white/80"
                      }`}
                    >
                      <span className="text-sm font-bold tracking-tight">Safe Drive</span>
                      <span className="mt-2 text-base font-bold">
                        {liveProgress !== null
                          ? `${liveProgress.safeDriveElapsedSec} s / ${
                              safeDriveTarget ?? "--"
                            } s`
                          : liveThresholds
                          ? `-- s / ${liveThresholds.safeDriveTargetSec} s`
                          : "-- s / -- s"}
                      </span>
                    </div>

                    {/* 2. Total Turns (Task 2) */}
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-colors ${
                        totalTurnsFailed
                          ? "border-rose-500/50 bg-rose-950/40 text-rose-300"
                          : totalTurnsPassed
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-400"
                          : "border-white/10 bg-black/40 text-white/80"
                      }`}
                    >
                      <span className="text-sm font-bold tracking-tight">Total Turns</span>
                      <span className="mt-2 text-base font-bold">
                        {liveProgress !== null
                          ? `${liveProgress.totalTurns} / ${
                              totalTurnsTarget ?? "--"
                            }`
                          : liveThresholds
                          ? `-- / ${liveThresholds.minTotalTurns}`
                          : "-- / --"}
                      </span>
                    </div>

                    {/* 3. Right Turns (Task 3 sub-target) */}
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-colors ${
                        rightTurnsFailed
                          ? "border-rose-500/50 bg-rose-950/40 text-rose-300"
                          : rightTurnsPassed
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-400"
                          : "border-white/10 bg-black/40 text-white/80"
                      }`}
                    >
                      <span className="text-sm font-bold tracking-tight">Right Turns</span>
                      <span className="mt-2 text-base font-bold">
                        {liveProgress !== null
                          ? `${liveProgress.rightTurns} / ${
                              rightTurnsTarget ?? "--"
                            }`
                          : liveThresholds
                          ? `-- / ${liveThresholds.minRightTurns}`
                          : "-- / --"}
                      </span>
                    </div>

                    {/* 4. Left Turns (Task 3 sub-target) */}
                    <div
                      className={`flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-colors ${
                        leftTurnsFailed
                          ? "border-rose-500/50 bg-rose-950/40 text-rose-300"
                          : leftTurnsPassed
                          ? "border-emerald-500/50 bg-emerald-950/40 text-emerald-400"
                          : "border-white/10 bg-black/40 text-white/80"
                      }`}
                    >
                      <span className="text-sm font-bold tracking-tight">Left Turns</span>
                      <span className="mt-2 text-base font-bold">
                        {liveProgress !== null
                          ? `${liveProgress.leftTurns} / ${
                              leftTurnsTarget ?? "--"
                            }`
                          : liveThresholds
                          ? `-- / ${liveThresholds.minLeftTurns}`
                          : "-- / --"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Control Panel Integration for Driving Controls & Telemetry */}
            <ControlPanel />
          </div>
        )}

        {/* RESULT MODAL */}
        <ResultModal
          isOpen={gameStateMode === "RESULT" && finalResult !== null}
          level={currentLevelId}
          score={finalResult?.score ?? 0}
          stars={finalResult?.stars ?? 0}
          bestScore={levelProgressMap[currentLevelId]?.bestScore ?? (finalResult?.score ?? 0)}
          hasNextLevel={currentLevelId < 6}
          isNextUnlocked={isLevelUnlocked(currentLevelId + 1, levelProgressMap, 6)}
          onReplay={handleRetryLevel}
          onNextLevel={handleNextLevel}
          onBackToLevels={() => router.push("/playground/inverted-drive/challenges")}
        />
      </div>
    </main>
  );
}
