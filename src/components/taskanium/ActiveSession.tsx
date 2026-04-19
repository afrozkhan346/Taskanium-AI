import { useEffect, useRef, useState } from "react";
import { Chassis } from "./Chassis";
import { DarkScreen } from "./LcdScreen";
import { MechButton } from "./MechButton";
import { PhaseLeds, type Phase } from "./PhaseLeds";
import { EnergyBadge, type Energy } from "./EnergyBadge";
import { DymoToast } from "./DymoToast";
import { useAdaptiveTimer } from "@/hooks/useAdaptiveTimer";
import { apiSpeak, playAudio, type SessionData } from "@/api";
import type { SessionEndStats } from "@/routes/index";

interface ActiveSessionProps {
  task: string;
  energy: Energy;
  session: SessionData;
  onDone: (stats: SessionEndStats) => void;
  onAbandon: (stats: SessionEndStats) => void;
}

const PHASE_LABELS: Record<0 | 1 | 2, Phase> = {
  0: "start",
  1: "mid",
  2: "end",
};

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ActiveSession({
  task,
  energy,
  session,
  onDone,
  onAbandon,
}: ActiveSessionProps) {
  // Latest spoken reminder message (shown in DymoToast)
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  // Prevent opening voice from firing twice in React strict mode
  const openingVoiceFired = useRef(false);

  // ── Opening voice on mount ─────────────────────────────────────────────────
  useEffect(() => {
    if (openingVoiceFired.current) return;
    openingVoiceFired.current = true;

    const playOpening = async () => {
      try {
        const result = await apiSpeak({
          session_id: session.session_id,
          task_text: task,
          energy,
          current_phase: 0,
          reminder_number: 0,
          is_doom_spiral: false,
        });
        playAudio(result.audio_base64);
        // Show opening message in toast
        setToastMessage(result.message_text);
        setShowToast(true);
        setToastKey((k) => k + 1);
      } catch (err) {
        console.warn("[ActiveSession] Opening voice failed:", err);
        // Fallback: show the text Gemini already gave us
        setToastMessage(session.opening_voice_text);
        setShowToast(true);
        setToastKey((k) => k + 1);
      }
    };

    playOpening();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Adaptive timer ─────────────────────────────────────────────────────────
  const timer = useAdaptiveTimer(
    {
      estimatedMinutes: session.estimated_minutes,
      phaseBoundaries: session.phase_boundaries,
      baseIntervalMinutes: session.base_interval_minutes,
    },
    async (phase, reminderNumber, isDoomSpiral) => {
      // Fire POST /speak → Gemini writes message → ElevenLabs speaks it
      try {
        const result = await apiSpeak({
          session_id: session.session_id,
          task_text: task,
          energy,
          current_phase: phase,
          reminder_number: reminderNumber,
          is_doom_spiral: isDoomSpiral,
        });
        playAudio(result.audio_base64);
        setToastMessage(result.message_text);
      } catch (err) {
        console.warn("[ActiveSession] /speak failed:", err);
        // Fallback messages — never leave user without feedback
        const fallbacks: Record<0 | 1 | 2, string> = {
          0: "Still with you. Just take one small step.",
          1: "Good progress. Keep going.",
          2: "Almost there. Home stretch.",
        };
        setToastMessage(
          isDoomSpiral
            ? "Hey — still there? Even the tiniest move counts."
            : fallbacks[phase]
        );
      } finally {
        setShowToast(true);
        setToastKey((k) => k + 1);
      }
    }
  );

  // Auto-hide toast after 8 seconds
  useEffect(() => {
    if (!showToast) return;
    const t = setTimeout(() => setShowToast(false), 8000);
    return () => clearTimeout(t);
  }, [showToast, toastKey]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const buildStats = (): SessionEndStats => ({
    sessionId: session.session_id,
    elapsedMinutes: Math.round(timer.elapsedMinutes),
    remindersSent: timer.reminderCount,
    remindersAcked: timer.remindersAcked,
    hyperfocusDetected: timer.isHyperfocus,
    currentPhase: timer.currentPhase,
  });

  const handleDone = () => onDone(buildStats());
  const handleAbandon = () => onAbandon(buildStats());

  const handleAck = () => {
    timer.acknowledgeReminder();
    setShowToast(false);
  };

  // ── Hyperfocus: auto-hide toast and shrink (Electron IPC handled in Part C)
  useEffect(() => {
    if (timer.isHyperfocus) setShowToast(false);
  }, [timer.isHyperfocus]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const phase = PHASE_LABELS[timer.currentPhase];

  return (
    <div className="relative">
      <Chassis size="md" className="w-[340px]">
        {/* Top diagnostics */}
        <div className="mb-5 flex items-start justify-between">
          <PhaseLeds phase={phase} />
          <EnergyBadge energy={energy} />
        </div>

        {/* Focus display — shows Gemini's first_step */}
        <DarkScreen
          className="mb-5"
          topRight={timer.isHyperfocus ? "HYPERFOCUS" : timer.isDoomSpiral ? "DOOM_SPIRAL" : `T-${fmt(timer.secondsUntilReminder)}`}
        >
          <p className="mt-3 max-w-[26ch] text-pretty text-sm leading-relaxed">
            {session.first_step}
          </p>
          {timer.isHyperfocus && (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              🔵 Deep flow detected · Reminders silenced
            </p>
          )}
          {timer.isDoomSpiral && !timer.isHyperfocus && (
            <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-amber-400/70">
              ▲ Checking in more frequently
            </p>
          )}
        </DarkScreen>

        {/* Session info row */}
        <div className="mb-4 flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          <span>Est. {session.estimated_minutes} min</span>
          <span>{Math.round(timer.elapsedMinutes)}m elapsed</span>
          <span>Phase {timer.currentPhase + 1}/3</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Decorative dial — rotates with phase */}
          <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-chassis-edge bg-zinc-200 shadow-[0_4px_6px_rgba(0,0,0,0.1),_inset_0_-4px_6px_rgba(0,0,0,0.1)]">
            <div
              className="absolute h-3.5 w-1 rounded-full bg-zinc-600"
              style={{
                top: "0.375rem",
                transform: `rotate(${timer.currentPhase * 60}deg)`,
                transformOrigin: "50% 1.125rem",
                transition: "transform 0.4s ease",
              }}
            />
            <div className="size-4 rounded-full bg-zinc-300 shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]" />
          </div>

          <MechButton
            variant="green"
            onClick={handleDone}
            className="flex flex-1 items-center justify-center"
          >
            Done ✔
          </MechButton>
        </div>

        {/* Abandon */}
        <button
          onClick={handleAbandon}
          className="mt-4 w-full font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 underline-offset-4 hover:text-muted-foreground hover:underline"
        >
          Abort sequence
        </button>
      </Chassis>

      {/* Reminder toast */}
      {showToast && toastMessage && (
        <div
          className="absolute -bottom-4 -right-6 z-10 cursor-pointer"
          key={toastKey}
          onClick={handleAck}
        >
          <DymoToast tag="AI" message={toastMessage} />
        </div>
      )}
    </div>
  );
}
