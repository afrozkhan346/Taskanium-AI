import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TimerConfig {
  estimatedMinutes: number;
  phaseBoundaries: [number, number]; // [phase1EndMin, phase2EndMin]
  baseIntervalMinutes: number;       // from Gemini: 5 | 15 | 25
}

export interface TimerState {
  currentPhase: 0 | 1 | 2;
  elapsedMinutes: number;
  secondsUntilReminder: number;
  missedReminders: number;
  reminderCount: number;
  remindersAcked: number;
  isDoomSpiral: boolean;
  isHyperfocus: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Phase multipliers from TASKANIUM_WORKFLOW.md:
 *   Phase 0 (Start):  base × 1.00  — frequent help while starting
 *   Phase 1 (Mid):    base × 0.65  — reduces as user gets going
 *   Phase 2 (End):    base × 0.35  — barely interrupts near finish
 */
const PHASE_MULTIPLIERS: [number, number, number] = [1.0, 0.65, 0.35];

/** Floor to prevent sub-30s intervals */
const MIN_INTERVAL_SECS = 30;

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAdaptiveTimer
 *
 * Drives the Taskanium reminder system:
 * - 3-phase intervals (start → mid → end)
 * - Doom spiral: 2+ missed reminders → escalate frequency
 * - Hyperfocus: 3+ ignored reminders, past start phase, NOT stuck → go silent
 *
 * @param config   Session plan from Gemini
 * @param onReminder  Called when a reminder fires (phase, reminderCount, isDoomSpiral)
 * @returns TimerState + acknowledgeReminder function
 */
export function useAdaptiveTimer(
  config: TimerConfig,
  onReminder: (
    phase: 0 | 1 | 2,
    reminderNumber: number,
    isDoomSpiral: boolean
  ) => void
) {
  // Track elapsed time in seconds
  const [elapsedSecs, setElapsedSecs] = useState(0);
  const [secondsUntilReminder, setSecondsUntilReminder] = useState(
    Math.round(config.baseIntervalMinutes * 60 * PHASE_MULTIPLIERS[0])
  );
  const [missedReminders, setMissedReminders] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const [remindersAcked, setRemindersAcked] = useState(0);

  // Track when user last interacted (for hyperfocus detection)
  const lastInteractionRef = useRef<number>(Date.now());

  // Stable ref for onReminder so it doesn't re-trigger useEffect
  const onReminderRef = useRef(onReminder);
  useEffect(() => { onReminderRef.current = onReminder; }, [onReminder]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const elapsedMinutes = elapsedSecs / 60;

  const currentPhase: 0 | 1 | 2 =
    elapsedMinutes < config.phaseBoundaries[0]
      ? 0
      : elapsedMinutes < config.phaseBoundaries[1]
      ? 1
      : 2;

  // Doom spiral: user missed 2+ reminders in a row
  const isDoomSpiral = missedReminders >= 2;

  // Hyperfocus: past start phase, 3+ missed, not stuck, user inactive for a while
  const timeSinceInteractionMins =
    (Date.now() - lastInteractionRef.current) / 1000 / 60;
  const isHyperfocus =
    !isDoomSpiral &&
    missedReminders >= 3 &&
    currentPhase > 0 &&
    timeSinceInteractionMins > config.baseIntervalMinutes * 2.5;

  // ── Interval calculator ──────────────────────────────────────────────────────

  const calcNextIntervalSecs = useCallback(
    (phase: 0 | 1 | 2, spiral: boolean): number => {
      let interval = config.baseIntervalMinutes * PHASE_MULTIPLIERS[phase];
      if (spiral) interval *= 0.5; // escalate during doom spiral
      return Math.round(Math.max(interval * 60, MIN_INTERVAL_SECS));
    },
    [config.baseIntervalMinutes]
  );

  // ── Main clock ───────────────────────────────────────────────────────────────

  useEffect(() => {
    // Pause all ticking during hyperfocus — don't interrupt deep flow
    if (isHyperfocus) return;

    const tick = setInterval(() => {
      setElapsedSecs((prev) => prev + 1);

      setSecondsUntilReminder((prev) => {
        if (prev > 1) return prev - 1;

        // ── Reminder fires! ──────────────────────────────────────────────────
        setReminderCount((count) => {
          const newCount = count + 1;

          setMissedReminders((missed) => {
            const newMissed = missed + 1;
            const newSpiral = newMissed >= 2;

            // Schedule next reminder
            setElapsedSecs((e) => {
              const phase: 0 | 1 | 2 =
                e / 60 < config.phaseBoundaries[0]
                  ? 0
                  : e / 60 < config.phaseBoundaries[1]
                  ? 1
                  : 2;
              const nextSecs = calcNextIntervalSecs(phase, newSpiral);
              setSecondsUntilReminder(nextSecs);

              // Fire the callback (Gemini + ElevenLabs will be called)
              onReminderRef.current(phase, newCount, newSpiral);

              return e; // no change to elapsed
            });

            return newMissed;
          });

          return newCount;
        });

        return 0;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [isHyperfocus, config.phaseBoundaries, calcNextIntervalSecs]);

  // ── Acknowledge ─────────────────────────────────────────────────────────────

  /** Call when user taps/dismisses a reminder — resets doom/hyperfocus state */
  const acknowledgeReminder = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setMissedReminders(0);
    setRemindersAcked((a) => a + 1);
  }, []);

  // ── Return ───────────────────────────────────────────────────────────────────

  return {
    currentPhase,
    elapsedMinutes,
    secondsUntilReminder,
    missedReminders,
    reminderCount,
    remindersAcked,
    isDoomSpiral,
    isHyperfocus,
    acknowledgeReminder,
  };
}
