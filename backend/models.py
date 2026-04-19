from pydantic import BaseModel
from typing import Optional


# ── /start-session ──────────────────────────────────────────────────────────

class StartSessionRequest(BaseModel):
    task_text: str
    energy_level: str  # "low" | "medium" | "high"


class StartSessionResponse(BaseModel):
    session_id: str
    first_step: str
    estimated_minutes: int
    phase_boundaries: list[int]   # [phase1_end_min, phase2_end_min]
    base_interval_minutes: int
    opening_voice_text: str


# ── /speak ───────────────────────────────────────────────────────────────────

class SpeakRequest(BaseModel):
    session_id: str
    task_text: str
    energy_level: str
    current_phase: int            # 0 | 1 | 2
    reminder_number: int
    is_doom_spiral: bool


class SpeakResponse(BaseModel):
    audio_base64: str
    message_text: str


# ── /end-session ─────────────────────────────────────────────────────────────

class EndSessionRequest(BaseModel):
    session_id: str
    completed: bool
    actual_minutes: int
    reminders_sent: int
    reminders_acknowledged: int
    abandoned_at_phase: Optional[str] = None  # "start" | "mid" | "end" | null
    hyperfocus_detected: bool


class EndSessionResponse(BaseModel):
    ok: bool


# ── /insights ────────────────────────────────────────────────────────────────

class InsightsResponse(BaseModel):
    total_sessions: int
    completion_rate: float
    avg_duration_by_energy: dict[str, float]
    sessions_by_day: list[dict]
    abandoned_phases: dict[str, int]
    hyperfocus_sessions: int
    avg_reminders_per_session: float
