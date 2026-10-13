"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Play,
  Bluetooth,
  Shuffle,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import SubPageHeader from "@/components/SubPageHeader";
import ResultModal from "@/components/ResultModal";
import ControlPanel from "@/components/ControlPanel";
import { useBleContext } from "@/context/BleContext";
import {
  calculateStars,
  getLevelConfig,
  isLevelUnlocked,
} from "@/lib/directionInvert";
import {
  fetchAndSyncProgress,
  submitAndPersistLevelResult,
} from "@/lib/progressStore";
import type {
  DirectionInvertGameState,
  LevelProgress,
  ObjectiveStatus,
} from "@/types/directionInvert";
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

  const [objectiveStatuses, setObjectiveStatuses] = useState<
    Record<1 | 2 | 3, ObjectiveStatus>
  >({
    1: "pending",
    2: "pending",
    3: "pending",
  });

  const [finalResult, setFinalResult] = useState<{
    score: number;
    stars: 0 | 1 | 2 | 3;
  } | null>(null);

  const [levelProgressMap, setLevelProgressMap] = useState<
    Record<number, LevelProgress>
  >({});
  const [isLocked, setIsLocked] = useState(false);

  // Load progress and check lock status
  useEffect(() => {
    async function loadProgress() {
      const prog = await fetchAndSyncProgress("inverted-drive");
      if (prog) {
        setLevelProgressMap(prog);
        if (!isLevelUnlocked(currentLevelId, prog, 6)) {
          setIsLocked(true);
        }
      }
    }
    void loadProgress();
  }, [currentLevelId]);

  // Handle game result from firmware
  const handleResult = useCallback(
    async (res: GameResultPayload) => {
      const computedStars = res.stars ?? calculateStars(res.score);
      setFinalResult({
        score: res.score,
        stars: computedStars,
      });

      await submitAndPersistLevelResult(
        "inverted-drive",
        currentLevelId,
        res.score,
        computedStars,
      );

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
    setObjectiveStatuses({ 1: "pending", 2: "pending", 3: "pending" });
    setFinalResult(null);
    await gameSession.start();
  };

  const handleAbortMission = async () => {
    await stop();
    await gameSession.abort();
    setGameStateMode("INSTRUCTIONS");
  };

  const handleNextLevel = () => {
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
    setGameStateMode("INSTRUCTIONS");
    setObjectiveStatuses({ 1: "pending", 2: "pending", 3: "pending" });
    setFinalResult(null);
    await handleStartMission();
  };

  if (isLocked) {
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
              <button
                onClick={handleAbortMission}
                className="rounded-xl border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-300"
              >
                Abort
              </button>
            </div>

            {/* Objectives Live Status */}
            <div className="rounded-2xl border border-white/10 bg-surface p-4">
              <span className="text-xs font-bold uppercase tracking-wider text-white/50">
                Live Objective Progress
              </span>
              <div className="mt-2.5 space-y-2">
                {levelConfig.objectives.map((obj) => {
                  const status = objectiveStatuses[obj.id];
                  return (
                    <div
                      key={obj.id}
                      className={`flex items-center justify-between rounded-xl border p-3 ${
                        status === "passed"
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                          : status === "failed"
                          ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                          : "border-white/10 bg-white/5 text-white/80"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold">
                          Task {obj.id}:
                        </span>
                        <span className="text-xs font-semibold">{obj.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-bold">
                        {status === "passed" && (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span>PASSED</span>
                          </>
                        )}
                        {status === "failed" && (
                          <>
                            <XCircle className="h-4 w-4 text-rose-400" />
                            <span>FAILED</span>
                          </>
                        )}
                        {status === "pending" && (
                          <>
                            <Clock className="h-4 w-4 text-amber-400 animate-spin" />
                            <span className="text-amber-300">IN PROGRESS</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

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
