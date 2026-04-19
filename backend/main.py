import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import (
    StartSessionRequest,
    StartSessionResponse,
    SpeakRequest,
    SpeakResponse,
    EndSessionRequest,
    EndSessionResponse,
    InsightsResponse,
)
from gemini_client import plan_session, generate_reminder_message
from elevenlabs_client import text_to_speech_base64
from snowflake_client import (
    ensure_table_exists,
    create_session,
    get_last_5_sessions,
    build_context_summary,
    update_session,
    get_insights,
)

load_dotenv()

app = FastAPI(title="Taskanium API", version="1.0.0")

# Allow requests from Electron renderer (file://) and Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup():
    """Create Snowflake sessions table if it doesn't already exist."""
    try:
        ensure_table_exists()
        print("[startup] Snowflake table ready ✓")
    except Exception as e:
        print(f"[startup] Snowflake table check failed (non-fatal): {e}")


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """DigitalOcean health check endpoint."""
    return {"status": "ok"}


@app.post("/start-session", response_model=StartSessionResponse)
def start_session(req: StartSessionRequest):
    """
    Full session planning flow:
    1. Fetch last 5 sessions from Snowflake
    2. Build context summary string
    3. Call Gemini to plan the session
    4. Create a new session row in Snowflake
    5. Return plan to frontend
    """
    # Step 1 & 2 — Snowflake context
    try:
        past_sessions = get_last_5_sessions()
        context = build_context_summary(past_sessions)
    except Exception as e:
        print(f"[start-session] Snowflake fetch failed (non-fatal): {e}")
        context = "No past session data available."

    # Step 3 — Gemini session plan
    try:
        plan = plan_session(req.task_text, req.energy_level, context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini planning failed: {e}")

    # Step 4 — Create Snowflake row
    try:
        session_id = create_session(
            task_text=req.task_text,
            energy_level=req.energy_level,
            estimated_mins=plan.get("estimated_minutes", 25),
        )
    except Exception as e:
        print(f"[start-session] Snowflake insert failed (non-fatal): {e}")
        session_id = str(uuid.uuid4())  # fallback — session still works without DB

    return StartSessionResponse(
        session_id=session_id,
        first_step=plan["first_step"],
        estimated_minutes=plan["estimated_minutes"],
        phase_boundaries=plan["phase_boundaries"],
        base_interval_minutes=plan["base_interval_minutes"],
        opening_voice_text=plan["opening_voice_text"],
    )


@app.post("/speak", response_model=SpeakResponse)
def speak(req: SpeakRequest):
    """
    Reminder voice flow:
    1. Gemini writes a fresh phase-aware spoken message
    2. ElevenLabs converts it to MP3 audio
    3. Return base64 audio + message text to frontend
    """
    # Step 1 — Gemini reminder message
    try:
        message = generate_reminder_message(
            task_text=req.task_text,
            energy_level=req.energy_level,
            current_phase=req.current_phase,
            reminder_number=req.reminder_number,
            is_doom_spiral=req.is_doom_spiral,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini message failed: {e}")

    # Step 2 — ElevenLabs TTS
    try:
        audio_b64 = text_to_speech_base64(message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ElevenLabs TTS failed: {e}")

    return SpeakResponse(audio_base64=audio_b64, message_text=message)


@app.post("/end-session", response_model=EndSessionResponse)
def end_session(req: EndSessionRequest):
    """
    Saves final session stats to Snowflake.
    Non-fatal — returns ok:true even if DB write fails.
    """
    try:
        update_session(
            session_id=req.session_id,
            completed=req.completed,
            actual_minutes=req.actual_minutes,
            reminders_sent=req.reminders_sent,
            reminders_acknowledged=req.reminders_acknowledged,
            abandoned_at_phase=req.abandoned_at_phase,
            hyperfocus_detected=req.hyperfocus_detected,
        )
    except Exception as e:
        print(f"[end-session] Snowflake update failed (non-fatal): {e}")
    return EndSessionResponse(ok=True)


@app.get("/insights", response_model=InsightsResponse)
def insights():
    """
    Returns aggregated session stats for the insights dashboard.
    Queried by the DigitalOcean-hosted insights page.
    """
    try:
        data = get_insights()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Snowflake insights query failed: {e}")
    return InsightsResponse(**data)
