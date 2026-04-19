import { useEffect } from "react";
import { Chassis } from "./Chassis";
import { DarkScreen } from "./LcdScreen";
import { MechButton } from "./MechButton";
import { apiEndSession } from "@/api";
import type { SessionEndStats } from "@/routes/index";

interface SessionEndProps {
  task: string;
  outcome: "done" | "abandon";
  stats: SessionEndStats;
  onReset: () => void;
}

export function SessionEnd({ task, outcome, stats, onReset }: SessionEndProps) {
  const done = outcome === "done";

  // ── Save to Snowflake on mount ─────────────────────────────────────────────
  useEffect(() => {
    const phaseToName = ["start", "mid", "end"] as const;

    apiEndSession({
      session_id: stats.sessionId,
      completed: done,
      actual_minutes: stats.elapsedMinutes,
      reminders_sent: stats.remindersSent,
      reminders_acknowledged: stats.remindersAcked,
      abandoned_at_phase: done ? null : phaseToName[stats.currentPhase],
      hyperfocus_detected: stats.hyperfocusDetected,
    }).catch((err) => {
      // Non-fatal — session data might be lost but UI keeps working
      console.warn("[SessionEnd] /end-session failed:", err);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stats summary row ──────────────────────────────────────────────────────
  const phaseName = ["Start", "Mid", "End"][stats.currentPhase];
  const hypnote = stats.hyperfocusDetected ? " · Hyperfocus detected 🔵" : "";

  return (
    <Chassis
      size="sm"
      label={done ? "MOD_03 // Sequence Complete" : "MOD_03 // Sequence Aborted"}
      version="v1.4"
      className="w-[300px]"
    >
      <DarkScreen className="mb-4" topRight={done ? "STATUS_OK" : "STATUS_HALT"}>
        <div className="space-y-2 py-2">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            {done ? "Task logged" : "Task halted"}
          </p>
          <p className="text-base leading-snug text-screen-text">{task}</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {done ? "+1 to your interest-based system" : "No shame. Energy logged."}
          </p>

          {/* Session stats */}
          <div className="mt-4 border-t border-zinc-700/40 pt-3 font-mono text-[9px] uppercase tracking-widest text-zinc-600">
            <div className="flex justify-between">
              <span>Duration</span>
              <span>{stats.elapsedMinutes} min</span>
            </div>
            <div className="flex justify-between">
              <span>Reminders</span>
              <span>{stats.remindersSent} sent · {stats.remindersAcked} ack'd</span>
            </div>
            <div className="flex justify-between">
              <span>Phase reached</span>
              <span>{phaseName}{hypnote}</span>
            </div>
          </div>
        </div>
      </DarkScreen>

      <MechButton
        variant={done ? "green" : "orange"}
        onClick={onReset}
        className="flex w-full items-center justify-center"
      >
        New Sequence
      </MechButton>
    </Chassis>
  );
}
