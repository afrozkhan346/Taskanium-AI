const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8000";

// ── Types ────────────────────────────────────────────────────────────────────

/** Energy type used across the frontend. "med" maps to "medium" for the API. */
export type Energy = "low" | "med" | "high";

/** Converts frontend Energy key → API string */
export function toApiEnergy(e: Energy): string {
  return e === "med" ? "medium" : e;
}

export interface SessionData {
  session_id: string;
  first_step: string;
  estimated_minutes: number;
  phase_boundaries: [number, number]; // [phase1_end_min, phase2_end_min]
  base_interval_minutes: number;
  opening_voice_text: string;
}

export interface SpeakResponse {
  audio_base64: string;
  message_text: string;
}

export interface EndSessionPayload {
  session_id: string;
  completed: boolean;
  actual_minutes: number;
  reminders_sent: number;
  reminders_acknowledged: number;
  abandoned_at_phase: "start" | "mid" | "end" | null;
  hyperfocus_detected: boolean;
}

// ── API calls ────────────────────────────────────────────────────────────────

/** POST /start-session — Gemini plans the session, returns first step + timing */
export async function apiStartSession(
  task_text: string,
  energy: Energy
): Promise<SessionData> {
  const res = await fetch(`${BASE}/start-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_text, energy_level: toApiEnergy(energy) }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`/start-session ${res.status}: ${detail}`);
  }
  return res.json() as Promise<SessionData>;
}

/** POST /speak — Gemini + ElevenLabs → returns base64 audio + message text */
export async function apiSpeak(payload: {
  session_id: string;
  task_text: string;
  energy: Energy;
  current_phase: number;
  reminder_number: number;
  is_doom_spiral: boolean;
}): Promise<SpeakResponse> {
  const res = await fetch(`${BASE}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: payload.session_id,
      task_text: payload.task_text,
      energy_level: toApiEnergy(payload.energy),
      current_phase: payload.current_phase,
      reminder_number: payload.reminder_number,
      is_doom_spiral: payload.is_doom_spiral,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`/speak ${res.status}: ${detail}`);
  }
  return res.json() as Promise<SpeakResponse>;
}

/** POST /end-session — saves final stats to Snowflake */
export async function apiEndSession(payload: EndSessionPayload): Promise<void> {
  await fetch(`${BASE}/end-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// ── Audio helper ─────────────────────────────────────────────────────────────

/** Plays base64-encoded MP3 audio in the browser */
export function playAudio(base64: string): void {
  try {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audio.play().catch((e) => console.warn("[audio] play() blocked:", e));
  } catch (e) {
    console.warn("[audio] failed to create Audio:", e);
  }
}
