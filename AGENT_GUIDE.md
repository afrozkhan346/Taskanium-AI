# TASKANIUM — AGENT BUILD GUIDE
> **For AI models only.** Every step is atomic. Do one step. Verify it. Do the next.
> Do NOT skip steps. Do NOT do multiple steps at once.
> Source of truth for all decisions: `TASKANIUM_WORKFLOW.md`

---

## 🧠 CONTEXT FIRST — READ THIS BEFORE ANYTHING

**What is Taskanium?**
An ADHD-friendly desktop focus widget. It shows ONE micro-step at a time, speaks reminders via AI voice, and learns from past sessions.

**Tech stack (LOCKED — do not change):**
- Frontend: React + Vite + Tailwind + Framer Motion (already scaffolded in `src/`)
- Backend: FastAPI (Python) — needs to be created in `backend/`
- Desktop: Electron — needs to be created in `electron/`
- Insights page: React (separate Vite app) — needs to be created in `insights/`

**Current state of the repo:**
- ✅ Frontend scaffold: `src/` exists with React components (TaskInput, ActiveSession, SessionEnd, etc.)
- ✅ UI prototype: runs with `npm run dev` — browse at http://localhost:5173
- ❌ Backend: does NOT exist yet — needs creating
- ❌ Electron shell: does NOT exist yet — needs creating
- ❌ Insights page: does NOT exist yet — needs creating
- ❌ Real API calls: frontend uses mock data — needs wiring

**File that explains everything:**
```
TASKANIUM_WORKFLOW.md  ← read this if you need specs for any feature
```

---

## 📋 MASTER STEP LIST

### PHASE A — Backend (FastAPI)
- [ ] A1. Create `backend/` folder
- [ ] A2. Create `backend/requirements.txt`
- [ ] A3. Create `backend/.env.example`
- [ ] A4. Create `backend/models.py`
- [ ] A5. Create `backend/gemini_client.py`
- [ ] A6. Create `backend/elevenlabs_client.py`
- [ ] A7. Create `backend/snowflake_client.py`
- [ ] A8. Create `backend/main.py` with all routes
- [ ] A9. Test backend locally

### PHASE B — Frontend Wiring
- [ ] B1. Create `src/api.ts` — all fetch wrappers
- [ ] B2. Wire `TaskInput.tsx` → POST /start-session
- [ ] B3. Wire `ActiveSession.tsx` → POST /speak on timers
- [ ] B4. Wire `SessionEnd.tsx` → POST /end-session
- [ ] B5. Create `src/hooks/useAdaptiveTimer.ts`
- [ ] B6. Wire useAdaptiveTimer into ActiveSession

### PHASE C — Electron Shell
- [ ] C1. Create `electron/package.json`
- [ ] C2. Create `electron/main.js`
- [ ] C3. Create `electron/preload.js`
- [ ] C4. Test Electron window launches

### PHASE D — Insights Page
- [ ] D1. Create `insights/` Vite app scaffold
- [ ] D2. Create `insights/src/App.jsx`

### PHASE E — Deployment
- [ ] E1. Create `.do/app.yaml`
- [ ] E2. Create `README.md`

---

## PHASE A — BACKEND

---

### A1 — Create `backend/` folder

**What:** Make the backend directory.

```powershell
New-Item -ItemType Directory -Path "backend"
```

**Verify:** `backend/` folder exists in project root.

---

### A2 — Create `backend/requirements.txt`

**What:** List all Python packages the backend needs.

**File to create:** `backend/requirements.txt`

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
python-dotenv==1.0.1
google-generativeai==0.5.4
elevenlabs==1.1.2
snowflake-connector-python==3.9.0
pydantic==2.7.1
httpx==0.27.0
```

**Verify:** File exists and has 8 lines.

---

### A3 — Create `backend/.env.example`

**What:** Template showing which env vars are needed. Real values go in `.env` (never committed).

**File to create:** `backend/.env.example`

```bash
GEMINI_API_KEY=your_key_here
ELEVENLABS_API_KEY=your_key_here
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

SNOWFLAKE_ACCOUNT=your_account_here
SNOWFLAKE_USER=your_user_here
SNOWFLAKE_PASSWORD=your_password_here
SNOWFLAKE_DATABASE=TASKANIUM_DB
SNOWFLAKE_SCHEMA=PUBLIC
SNOWFLAKE_WAREHOUSE=COMPUTE_WH
```

**Verify:** File has 9 lines. No real keys in this file.

---

### A4 — Create `backend/models.py`

**What:** All Pydantic models for request/response. No logic here — only data shapes.

**File to create:** `backend/models.py`

```python
from pydantic import BaseModel
from typing import Optional


# ── /start-session ──────────────────────────────────────────
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


# ── /speak ───────────────────────────────────────────────────
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


# ── /end-session ─────────────────────────────────────────────
class EndSessionRequest(BaseModel):
    session_id: str
    completed: bool
    actual_minutes: int
    reminders_sent: int
    reminders_acknowledged: int
    abandoned_at_phase: Optional[str] = None   # "start" | "mid" | "end" | null
    hyperfocus_detected: bool


class EndSessionResponse(BaseModel):
    ok: bool


# ── /insights ────────────────────────────────────────────────
class InsightsResponse(BaseModel):
    total_sessions: int
    completion_rate: float
    avg_duration_by_energy: dict[str, float]
    sessions_by_day: list[dict]
    abandoned_phases: dict[str, int]
    hyperfocus_sessions: int
    avg_reminders_per_session: float
```

**Verify:** File has all 6 classes: StartSessionRequest, StartSessionResponse, SpeakRequest, SpeakResponse, EndSessionRequest, EndSessionResponse, InsightsResponse.

---

### A5 — Create `backend/gemini_client.py`

**What:** All Gemini API calls. Two functions only: `plan_session()` and `generate_reminder_message()`.

**File to create:** `backend/gemini_client.py`

```python
import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
_model = genai.GenerativeModel("gemini-1.5-flash")


def plan_session(task_text: str, energy_level: str, past_context: str) -> dict:
    """
    Calls Gemini to plan a focus session.
    Returns dict with: first_step, estimated_minutes, phase_boundaries,
                       base_interval_minutes, opening_voice_text
    """
    prompt = f"""You are Taskanium, an AI assistant designed specifically for ADHD brains.

Task: {task_text}
Energy level: {energy_level} (low / medium / high)
Past sessions: {past_context}

Return ONLY valid JSON, no markdown:
{{
  "first_step": "One action under 12 words. Low energy = tiny (just open the file). High energy = real chunk.",
  "estimated_minutes": <realistic integer>,
  "phase_boundaries": [<min when phase 1 ends>, <min when phase 2 ends>],
  "base_interval_minutes": <5 for low, 15 for medium, 25 for high>,
  "opening_voice_text": "Warm 1-sentence opening. Acknowledge low energy if applicable."
}}

Rules:
- Never use productivity jargon
- Tone: warm friend, not life coach
- Low energy = acknowledge that starting IS the win
- Adjust estimates based on past session history if provided"""

    response = _model.generate_content(prompt)
    raw = response.text.strip()
    # Strip markdown fences if Gemini adds them
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def generate_reminder_message(
    task_text: str,
    energy_level: str,
    current_phase: int,
    reminder_number: int,
    is_doom_spiral: bool,
) -> str:
    """
    Calls Gemini to generate a fresh spoken reminder message.
    Returns a single string (the spoken message).
    """
    phase_labels = {0: "Start", 1: "Mid", 2: "End"}
    phase_tones = {
        0: "Warm and encouraging — they are still getting started.",
        1: "Brief check-in — they are in the middle of working.",
        2: "Minimal — they are almost done, don't break flow.",
    }
    doom_note = (
        " The user appears to be stuck or avoidant. Be gentle, present, and give permission to just do the tiniest thing."
        if is_doom_spiral
        else ""
    )

    prompt = f"""You are the voice of Taskanium.

Task: {task_text}
Energy: {energy_level}
Session phase: {phase_labels[current_phase]} — {phase_tones[current_phase]}
Reminder number: {reminder_number}
Doom spiral: {is_doom_spiral}{doom_note}

Write ONE short spoken sentence (10-20 words). It must:
- Feel fresh — never sound like a template
- Be warm and human, not robotic
- Never be judgmental
- Not start with "Hey" more than once in a session
- Vary your phrasing naturally

Return ONLY the sentence. No quotes. No explanation."""

    response = _model.generate_content(prompt)
    return response.text.strip().strip('"').strip("'")
```

**Verify:** Two functions exist: `plan_session` and `generate_reminder_message`. No imports other than os, json, genai, dotenv.

---

### A6 — Create `backend/elevenlabs_client.py`

**What:** Converts text to speech using ElevenLabs. Returns base64 audio.

**File to create:** `backend/elevenlabs_client.py`

```python
import os
import base64
import httpx
from dotenv import load_dotenv

load_dotenv()

_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
_BASE_URL = "https://api.elevenlabs.io/v1"


def text_to_speech_base64(text: str) -> str:
    """
    Sends text to ElevenLabs TTS.
    Returns base64-encoded MP3 audio string.
    """
    url = f"{_BASE_URL}/text-to-speech/{_VOICE_ID}"
    headers = {
        "xi-api-key": _API_KEY,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
    }
    payload = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
            "stability": 0.75,
            "similarity_boost": 0.85,
        },
    }

    with httpx.Client(timeout=30) as client:
        response = client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        audio_bytes = response.content

    return base64.b64encode(audio_bytes).decode("utf-8")
```

**Verify:** One function: `text_to_speech_base64(text)` → returns string.

---

### A7 — Create `backend/snowflake_client.py`

**What:** All Snowflake database operations. Create table, insert session, update session, get last 5 sessions, get insights.

**File to create:** `backend/snowflake_client.py`

```python
import os
import uuid
from datetime import datetime
from typing import Optional
import snowflake.connector
from dotenv import load_dotenv

load_dotenv()


def _get_conn():
    """Opens a fresh Snowflake connection. Close after use."""
    return snowflake.connector.connect(
        account=os.environ["SNOWFLAKE_ACCOUNT"],
        user=os.environ["SNOWFLAKE_USER"],
        password=os.environ["SNOWFLAKE_PASSWORD"],
        database=os.environ.get("SNOWFLAKE_DATABASE", "TASKANIUM_DB"),
        schema=os.environ.get("SNOWFLAKE_SCHEMA", "PUBLIC"),
        warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH"),
    )


def ensure_table_exists():
    """
    Creates the sessions table if it doesn't already exist.
    Call once at startup in main.py.
    """
    sql = """
    CREATE TABLE IF NOT EXISTS sessions (
        id                      VARCHAR(36) DEFAULT UUID_STRING() PRIMARY KEY,
        task_text               VARCHAR(500),
        energy_level            VARCHAR(10),
        estimated_mins          INTEGER,
        actual_mins             INTEGER,
        reminders_sent          INTEGER,
        reminders_acknowledged  INTEGER,
        completed               BOOLEAN,
        abandoned_at_phase      VARCHAR(10),
        hyperfocus_detected     BOOLEAN,
        started_at              TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
        ended_at                TIMESTAMP_NTZ
    )
    """
    conn = _get_conn()
    try:
        conn.cursor().execute(sql)
        conn.commit()
    finally:
        conn.close()


def create_session(task_text: str, energy_level: str, estimated_mins: int) -> str:
    """
    Inserts a new session row. Returns the new session_id (UUID string).
    """
    session_id = str(uuid.uuid4())
    sql = """
    INSERT INTO sessions (id, task_text, energy_level, estimated_mins)
    VALUES (%s, %s, %s, %s)
    """
    conn = _get_conn()
    try:
        conn.cursor().execute(sql, (session_id, task_text, energy_level, estimated_mins))
        conn.commit()
    finally:
        conn.close()
    return session_id


def get_last_5_sessions(energy_level: str) -> list[dict]:
    """
    Fetches up to 5 most recent sessions for context injection into Gemini.
    """
    sql = """
    SELECT task_text, energy_level, estimated_mins, actual_mins,
           completed, abandoned_at_phase, hyperfocus_detected
    FROM sessions
    ORDER BY started_at DESC
    LIMIT 5
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        cols = [d[0].lower() for d in cur.description]
        return [dict(zip(cols, row)) for row in rows]
    finally:
        conn.close()


def build_context_summary(sessions: list[dict]) -> str:
    """
    Converts last 5 sessions into a human-readable string for Gemini.
    """
    if not sessions:
        return "No past sessions found. This is the user's first session."

    completed = sum(1 for s in sessions if s.get("completed"))
    total = len(sessions)
    abandoned_starts = sum(
        1 for s in sessions if s.get("abandoned_at_phase") == "start"
    )
    hyperfocus_count = sum(1 for s in sessions if s.get("hyperfocus_detected"))

    lines = [
        f"Past session context ({total} sessions):",
        f"- Completed: {completed} of {total}",
    ]
    if abandoned_starts:
        lines.append(f"- Abandoned at start phase: {abandoned_starts} times")
    if hyperfocus_count:
        lines.append(f"- Hyperfocus detected in: {hyperfocus_count} sessions")

    # Average actual time for matching energy
    return "\n".join(lines)


def update_session(
    session_id: str,
    completed: bool,
    actual_minutes: int,
    reminders_sent: int,
    reminders_acknowledged: int,
    abandoned_at_phase: Optional[str],
    hyperfocus_detected: bool,
):
    """
    Updates a session row when the user finishes (Done or Abandon).
    """
    sql = """
    UPDATE sessions SET
        completed               = %s,
        actual_mins             = %s,
        reminders_sent          = %s,
        reminders_acknowledged  = %s,
        abandoned_at_phase      = %s,
        hyperfocus_detected     = %s,
        ended_at                = CURRENT_TIMESTAMP()
    WHERE id = %s
    """
    conn = _get_conn()
    try:
        conn.cursor().execute(
            sql,
            (
                completed,
                actual_minutes,
                reminders_sent,
                reminders_acknowledged,
                abandoned_at_phase,
                hyperfocus_detected,
                session_id,
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_insights() -> dict:
    """
    Aggregation queries for the insights dashboard.
    Returns a dict matching InsightsResponse.
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()

        # Total sessions
        cur.execute("SELECT COUNT(*) FROM sessions WHERE ended_at IS NOT NULL")
        total = cur.fetchone()[0]

        if total == 0:
            return {
                "total_sessions": 0,
                "completion_rate": 0.0,
                "avg_duration_by_energy": {"low": 0, "medium": 0, "high": 0},
                "sessions_by_day": [],
                "abandoned_phases": {"start": 0, "mid": 0, "end": 0},
                "hyperfocus_sessions": 0,
                "avg_reminders_per_session": 0.0,
            }

        # Completion rate
        cur.execute(
            "SELECT COUNT(*) FROM sessions WHERE completed = TRUE AND ended_at IS NOT NULL"
        )
        completed = cur.fetchone()[0]
        completion_rate = round(completed / total, 2) if total else 0.0

        # Avg duration by energy
        avg_by_energy = {}
        for energy in ("low", "medium", "high"):
            cur.execute(
                "SELECT AVG(actual_mins) FROM sessions WHERE energy_level = %s AND actual_mins IS NOT NULL",
                (energy,),
            )
            val = cur.fetchone()[0]
            avg_by_energy[energy] = round(val, 1) if val else 0.0

        # Sessions by day (last 14 days)
        cur.execute(
            """
            SELECT DATE(started_at) as day, COUNT(*) as cnt
            FROM sessions
            WHERE started_at >= DATEADD(day, -14, CURRENT_TIMESTAMP())
            GROUP BY day
            ORDER BY day
            """
        )
        sessions_by_day = [{"date": str(row[0]), "count": row[1]} for row in cur.fetchall()]

        # Abandoned phases
        abandoned_phases = {"start": 0, "mid": 0, "end": 0}
        cur.execute(
            """
            SELECT abandoned_at_phase, COUNT(*)
            FROM sessions
            WHERE abandoned_at_phase IS NOT NULL
            GROUP BY abandoned_at_phase
            """
        )
        for phase, count in cur.fetchall():
            if phase in abandoned_phases:
                abandoned_phases[phase] = count

        # Hyperfocus sessions
        cur.execute(
            "SELECT COUNT(*) FROM sessions WHERE hyperfocus_detected = TRUE AND ended_at IS NOT NULL"
        )
        hyperfocus_sessions = cur.fetchone()[0]

        # Avg reminders per session
        cur.execute(
            "SELECT AVG(reminders_sent) FROM sessions WHERE ended_at IS NOT NULL AND reminders_sent IS NOT NULL"
        )
        avg_reminders = round(cur.fetchone()[0] or 0.0, 1)

        return {
            "total_sessions": total,
            "completion_rate": completion_rate,
            "avg_duration_by_energy": avg_by_energy,
            "sessions_by_day": sessions_by_day,
            "abandoned_phases": abandoned_phases,
            "hyperfocus_sessions": hyperfocus_sessions,
            "avg_reminders_per_session": avg_reminders,
        }
    finally:
        conn.close()
```

**Verify:** 6 functions exist: `_get_conn`, `ensure_table_exists`, `create_session`, `get_last_5_sessions`, `build_context_summary`, `update_session`, `get_insights`.

---

### A8 — Create `backend/main.py`

**What:** FastAPI app with all 5 routes wired together.

**File to create:** `backend/main.py`

```python
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from models import (
    StartSessionRequest, StartSessionResponse,
    SpeakRequest, SpeakResponse,
    EndSessionRequest, EndSessionResponse,
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

# Allow requests from Electron renderer (file://) and local dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    """Create Snowflake table if it doesn't exist."""
    try:
        ensure_table_exists()
    except Exception as e:
        print(f"[startup] Snowflake table check failed: {e}")


# ── ROUTES ────────────────────────────────────────────────


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/start-session", response_model=StartSessionResponse)
def start_session(req: StartSessionRequest):
    """
    1. Fetch last 5 sessions from Snowflake
    2. Build context summary
    3. Call Gemini to plan the session
    4. Create session row in Snowflake
    5. Return session data to frontend
    """
    # Step 1 & 2 — get Snowflake context
    try:
        past_sessions = get_last_5_sessions(req.energy_level)
        context = build_context_summary(past_sessions)
    except Exception as e:
        print(f"[start-session] Snowflake fetch failed: {e}")
        context = "No past session data available."

    # Step 3 — Gemini plan
    try:
        plan = plan_session(req.task_text, req.energy_level, context)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {e}")

    # Step 4 — create session row
    try:
        session_id = create_session(
            req.task_text,
            req.energy_level,
            plan.get("estimated_minutes", 25),
        )
    except Exception as e:
        print(f"[start-session] Snowflake insert failed: {e}")
        import uuid
        session_id = str(uuid.uuid4())  # fallback — session still works

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
    1. Gemini generates a fresh spoken message
    2. ElevenLabs converts it to audio
    3. Return base64 audio + message text
    """
    # Step 1 — generate message
    try:
        message = generate_reminder_message(
            task_text=req.task_text,
            energy_level=req.energy_level,
            current_phase=req.current_phase,
            reminder_number=req.reminder_number,
            is_doom_spiral=req.is_doom_spiral,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini error: {e}")

    # Step 2 — TTS
    try:
        audio_b64 = text_to_speech_base64(message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ElevenLabs error: {e}")

    return SpeakResponse(audio_base64=audio_b64, message_text=message)


@app.post("/end-session", response_model=EndSessionResponse)
def end_session(req: EndSessionRequest):
    """Saves final session stats to Snowflake."""
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
        print(f"[end-session] Snowflake update failed: {e}")
        # Don't crash — session data loss is recoverable
    return EndSessionResponse(ok=True)


@app.get("/insights", response_model=InsightsResponse)
def insights():
    """Aggregates Snowflake data for the insights dashboard."""
    try:
        data = get_insights()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Snowflake error: {e}")
    return InsightsResponse(**data)
```

**Verify:** 5 routes exist: GET /health, POST /start-session, POST /speak, POST /end-session, GET /insights.

---

### A9 — Test backend locally

**What:** Install deps and run the server. Confirm it starts.

```powershell
# From project root
cd backend
python -m pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Expected output:**
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Application startup complete.
```

**Test in browser:** Open http://127.0.0.1:8000/health — should return `{"status":"ok"}`
**Test docs:** Open http://127.0.0.1:8000/docs — FastAPI auto-docs should appear

**Common errors:**
| Error | Fix |
|---|---|
| `ModuleNotFoundError: google.generativeai` | Run `pip install google-generativeai` |
| `KeyError: GEMINI_API_KEY` | Create `backend/.env` with real keys |
| Port 8000 in use | Use `--port 8001` instead |

---

## PHASE B — FRONTEND WIRING

---

### B1 — Create `src/api.ts`

**What:** All fetch wrappers. Frontend imports from here only — never uses raw fetch directly.

**File to create:** `src/api.ts`

```typescript
const BASE = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

// ── Types ──────────────────────────────────────────────────

export interface StartSessionResponse {
  session_id: string;
  first_step: string;
  estimated_minutes: number;
  phase_boundaries: [number, number];
  base_interval_minutes: number;
  opening_voice_text: string;
}

export interface SpeakResponse {
  audio_base64: string;
  message_text: string;
}

export interface EndSessionRequest {
  session_id: string;
  completed: boolean;
  actual_minutes: number;
  reminders_sent: number;
  reminders_acknowledged: number;
  abandoned_at_phase: "start" | "mid" | "end" | null;
  hyperfocus_detected: boolean;
}

// ── API Calls ──────────────────────────────────────────────

export async function apiStartSession(
  task_text: string,
  energy_level: string
): Promise<StartSessionResponse> {
  const res = await fetch(`${BASE}/start-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_text, energy_level }),
  });
  if (!res.ok) throw new Error(`/start-session failed: ${res.status}`);
  return res.json();
}

export async function apiSpeak(payload: {
  session_id: string;
  task_text: string;
  energy_level: string;
  current_phase: number;
  reminder_number: number;
  is_doom_spiral: boolean;
}): Promise<SpeakResponse> {
  const res = await fetch(`${BASE}/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`/speak failed: ${res.status}`);
  return res.json();
}

export async function apiEndSession(req: EndSessionRequest): Promise<void> {
  await fetch(`${BASE}/end-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
}

export function playAudio(base64: string): void {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.play().catch((e) => console.warn("Audio play failed:", e));
}
```

**Verify:** 4 exports: `apiStartSession`, `apiSpeak`, `apiEndSession`, `playAudio`.

---

### B2 — Wire `TaskInput.tsx` → POST /start-session

**What:** When user clicks Start, call the real backend instead of using mock data.

**File to edit:** `src/components/taskanium/TaskInput.tsx`

**Find the `onStart` call** — it currently passes just task and energy.
**Change it** to also call `apiStartSession` and pass the response up.

Look for the submit handler and update it:

```typescript
// ADD these imports at the top of TaskInput.tsx
import { apiStartSession } from "@/api";
import type { StartSessionResponse } from "@/api";
```

The `onStart` prop signature needs to change. The parent (`index.tsx`) must receive the session response.

Update the prop type in `TaskInput.tsx`:
```typescript
// Before:
onStart: (task: string, energy: Energy) => void;

// After:
onStart: (task: string, energy: Energy, session: StartSessionResponse) => void;
```

In the submit handler inside `TaskInput.tsx`:
```typescript
// Replace the direct onStart call with this:
const handleStart = async () => {
  if (!task.trim()) return;
  setLoading(true);
  try {
    const session = await apiStartSession(task.trim(), energy);
    onStart(task.trim(), energy, session);
  } catch (err) {
    console.error("Failed to start session:", err);
    // Optionally show error to user
  } finally {
    setLoading(false);
  }
};
```

**Also add** a `loading` state and disable the button while loading:
```typescript
const [loading, setLoading] = useState(false);
// ... on the button:
disabled={loading || !task.trim()}
```

**Update `src/routes/index.tsx`** to receive the session:

```typescript
// Update the state type:
| { kind: "active"; task: string; energy: Energy; session: StartSessionResponse }

// Update the onStart handler:
onStart={(task, energy, session) =>
  setState({ kind: "active", task, energy, session })
}
```

**Verify:** Typing a task and clicking Start now calls the real backend. Check browser console — no 404 errors.

---

### B3 — Create `src/hooks/useAdaptiveTimer.ts`

**What:** The core timer logic. 3 phases, doom spiral detection, hyperfocus detection.

**File to create:** `src/hooks/useAdaptiveTimer.ts`

```typescript
import { useState, useEffect, useRef, useCallback } from "react";

interface TimerConfig {
  estimatedMinutes: number;
  phaseBoundaries: [number, number]; // [phase1End, phase2End] in minutes
  baseIntervalMinutes: number;
}

interface TimerState {
  currentPhase: 0 | 1 | 2;
  secondsUntilReminder: number;
  missedReminders: number;
  isDoomSpiral: boolean;
  isHyperfocus: boolean;
  elapsedMinutes: number;
  reminderCount: number;
}

interface UseAdaptiveTimerReturn extends TimerState {
  acknowledgeReminder: () => void;  // Call when user taps reminder
  onReminderFired: () => void;      // Internal — fired when timer hits 0
}

const PHASE_MULTIPLIERS = [1.0, 0.65, 0.35];

export function useAdaptiveTimer(
  config: TimerConfig,
  onReminder: (phase: number, reminderNumber: number, isDoomSpiral: boolean) => void
): UseAdaptiveTimerReturn {
  const [elapsed, setElapsed] = useState(0); // seconds
  const [secondsUntilReminder, setSecondsUntilReminder] = useState(
    Math.round(config.baseIntervalMinutes * 60 * PHASE_MULTIPLIERS[0])
  );
  const [missedReminders, setMissedReminders] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const lastInteractionRef = useRef(Date.now());

  // Compute current phase from elapsed time
  const getPhase = useCallback(
    (elapsedSecs: number): 0 | 1 | 2 => {
      const mins = elapsedSecs / 60;
      if (mins < config.phaseBoundaries[0]) return 0;
      if (mins < config.phaseBoundaries[1]) return 1;
      return 2;
    },
    [config.phaseBoundaries]
  );

  const currentPhase = getPhase(elapsed);
  const elapsedMinutes = elapsed / 60;

  // Doom spiral: 2+ missed reminders
  const isDoomSpiral = missedReminders >= 2;

  // Hyperfocus: past start phase, 3+ missed reminders, no doom spiral, long inactivity
  const timeSinceInteraction = (Date.now() - lastInteractionRef.current) / 1000 / 60;
  const isHyperfocus =
    !isDoomSpiral &&
    missedReminders >= 3 &&
    currentPhase > 0 &&
    timeSinceInteraction > config.baseIntervalMinutes * 2.5;

  // Main clock — ticks every second
  useEffect(() => {
    if (isHyperfocus) return; // pause timer in hyperfocus

    const tick = setInterval(() => {
      setElapsed((e) => e + 1);
      setSecondsUntilReminder((s) => {
        if (s <= 1) {
          // Reminder fires!
          setReminderCount((count) => {
            const newCount = count + 1;
            setMissedReminders((missed) => {
              const newMissed = missed + 1;
              const spiral = newMissed >= 2;
              // Calculate next interval
              const phase = getPhase(elapsed + 1);
              let interval = config.baseIntervalMinutes * PHASE_MULTIPLIERS[phase];
              if (spiral) interval *= 0.5; // escalate in doom spiral
              const nextSecs = Math.round(Math.max(interval * 60, 30)); // min 30s
              onReminder(phase, newCount, spiral);
              setSecondsUntilReminder(nextSecs);
              return newMissed;
            });
            return newCount;
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [isHyperfocus, elapsed, config.baseIntervalMinutes, getPhase, onReminder]);

  const acknowledgeReminder = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setMissedReminders(0);
  }, []);

  return {
    currentPhase,
    secondsUntilReminder,
    missedReminders,
    isDoomSpiral,
    isHyperfocus,
    elapsedMinutes,
    reminderCount,
    acknowledgeReminder,
    onReminderFired: acknowledgeReminder,
  };
}
```

**Verify:** File exports `useAdaptiveTimer`. It takes a config and an `onReminder` callback. Returns timer state + `acknowledgeReminder`.

---

### B4 — Wire `ActiveSession.tsx` → useAdaptiveTimer + POST /speak

**What:** Connect the timer hook and API calls to the active session component.

**File to edit:** `src/components/taskanium/ActiveSession.tsx`

**Add these imports at the top:**
```typescript
import { useAdaptiveTimer } from "@/hooks/useAdaptiveTimer";
import { apiSpeak, playAudio } from "@/api";
import type { StartSessionResponse } from "@/api";
```

**Update the component props** to receive session data:
```typescript
interface ActiveSessionProps {
  task: string;
  energy: string;
  session: StartSessionResponse;  // ADD this
  onDone: () => void;
  onAbandon: () => void;
}
```

**Inside the component, add the timer hook:**
```typescript
const timer = useAdaptiveTimer(
  {
    estimatedMinutes: session.estimated_minutes,
    phaseBoundaries: session.phase_boundaries,
    baseIntervalMinutes: session.base_interval_minutes,
  },
  async (phase, reminderNumber, isDoomSpiral) => {
    // Fire when timer triggers a reminder
    try {
      const result = await apiSpeak({
        session_id: session.session_id,
        task_text: task,
        energy_level: energy,
        current_phase: phase,
        reminder_number: reminderNumber,
        is_doom_spiral: isDoomSpiral,
      });
      playAudio(result.audio_base64);
    } catch (err) {
      console.warn("Reminder failed:", err);
    }
  }
);
```

**Play the opening voice** when the component mounts:
```typescript
useEffect(() => {
  // Play opening voice immediately on session start
  const speak = async () => {
    try {
      const result = await apiSpeak({
        session_id: session.session_id,
        task_text: task,
        energy_level: energy,
        current_phase: 0,
        reminder_number: 0,
        is_doom_spiral: false,
      });
      playAudio(result.audio_base64);
    } catch (err) {
      console.warn("Opening voice failed:", err);
    }
  };
  speak();
}, []); // eslint-disable-line
```

**Show timer state in the UI:**
```typescript
// Use these values in the JSX:
timer.currentPhase       // 0, 1, or 2 → pass to PhaseLeds
timer.secondsUntilReminder
timer.isDoomSpiral
timer.isHyperfocus
timer.elapsedMinutes
```

**Verify:** Active session now shows real data from Gemini. Console shows reminder fires after the configured interval.

---

### B5 — Wire `SessionEnd.tsx` → POST /end-session

**What:** When user clicks Done or Abandon, save the session to Snowflake.

**File to edit:** `src/components/taskanium/SessionEnd.tsx`

**Add import:**
```typescript
import { apiEndSession } from "@/api";
```

**Update props to receive session data:**
```typescript
interface SessionEndProps {
  task: string;
  outcome: "done" | "abandon";
  session: StartSessionResponse;
  elapsedMinutes: number;
  remindersCount: number;       // from timer.reminderCount
  remindersAcked: number;       // track separately
  hyperfocusDetected: boolean;  // from timer.isHyperfocus
  currentPhase: number;         // for abandoned_at_phase
  onReset: () => void;
}
```

**Call apiEndSession when component mounts:**
```typescript
useEffect(() => {
  const phaseNames = ["start", "mid", "end"] as const;
  apiEndSession({
    session_id: session.session_id,
    completed: outcome === "done",
    actual_minutes: Math.round(elapsedMinutes),
    reminders_sent: remindersCount,
    reminders_acknowledged: remindersAcked,
    abandoned_at_phase: outcome === "abandon" ? phaseNames[currentPhase] : null,
    hyperfocus_detected: hyperfocusDetected,
  }).catch((e) => console.warn("end-session failed:", e));
}, []); // eslint-disable-line
```

**Verify:** After clicking Done or Abandon, check Snowflake — a row should have `ended_at` populated.

---

## PHASE C — ELECTRON SHELL

---

### C1 — Create `electron/package.json`

**What:** Electron app config and build settings.

**File to create:** `electron/package.json`

```json
{
  "name": "taskanium-electron",
  "version": "1.0.0",
  "description": "Taskanium — ADHD focus widget",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder --win --x64",
    "dev": "electron . --dev"
  },
  "build": {
    "appId": "com.taskanium.app",
    "productName": "Taskanium",
    "directories": {
      "output": "dist"
    },
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": true,
      "deleteAppDataOnUninstall": false
    },
    "files": [
      "main.js",
      "preload.js",
      "../dist/**/*"
    ]
  },
  "devDependencies": {
    "electron": "^30.0.0",
    "electron-builder": "^24.0.0"
  }
}
```

**Verify:** File has `"main": "main.js"` and `"electron"` in devDependencies.

---

### C2 — Create `electron/main.js`

**What:** Main Electron process. Creates the always-on-top window and handles all IPC.

**File to create:** `electron/main.js`

```javascript
const { app, BrowserWindow, ipcMain, shell, screen } = require("electron");
const path = require("path");

const isDev = process.argv.includes("--dev");

let win;

function createWindow() {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;

  win = new BrowserWindow({
    width: 320,
    height: 420,
    x: screenWidth - 340,
    y: screenHeight - 440,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Always on top — even above fullscreen apps
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true);

  if (isDev) {
    // Load Vite dev server
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    // Load built frontend
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── IPC handlers ────────────────────────────────────────────

ipcMain.on("minimize-to-bubble", () => {
  if (!win) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(64, 64);
  win.setPosition(sw - 84, sh - 84);
});

ipcMain.on("minimize-to-hyperfocus", () => {
  if (!win) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(40, 40);
  win.setPosition(sw - 56, sh - 56);
});

ipcMain.on("expand-to-panel", () => {
  if (!win) return;
  const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;
  win.setSize(320, 420);
  win.setPosition(sw - 340, sh - 440);
});

ipcMain.on("open-insights", () => {
  shell.openExternal("https://taskanium.ondigitalocean.app/insights");
});
```

**Verify:** 4 IPC handlers: `minimize-to-bubble`, `minimize-to-hyperfocus`, `expand-to-panel`, `open-insights`.

---

### C3 — Create `electron/preload.js`

**What:** Bridges the IPC channel between renderer (React) and main process (Electron).

**File to create:** `electron/preload.js`

```javascript
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("taskanium", {
  minimizeToBubble: () => ipcRenderer.send("minimize-to-bubble"),
  minimizeToHyperfocus: () => ipcRenderer.send("minimize-to-hyperfocus"),
  expandToPanel: () => ipcRenderer.send("expand-to-panel"),
  openInsights: () => ipcRenderer.send("open-insights"),
});
```

**Usage in React:**
```typescript
// In any React component:
declare global {
  interface Window {
    taskanium?: {
      minimizeToBubble: () => void;
      minimizeToHyperfocus: () => void;
      expandToPanel: () => void;
      openInsights: () => void;
    };
  }
}

// Call like this (safe — works in browser too):
window.taskanium?.minimizeToBubble();
```

**Verify:** `contextBridge.exposeInMainWorld` exposes 4 functions under `window.taskanium`.

---

### C4 — Test Electron window

**Steps:**

1. Build the frontend first:
```powershell
npm run build
```

2. Install Electron deps:
```powershell
cd electron
npm install
```

3. Run in dev mode (loads Vite dev server):
```powershell
# Terminal 1: start Vite dev server
npm run dev

# Terminal 2: start Electron
cd electron
npm start -- --dev
```

**Expected:** A small always-on-top window appears in the bottom-right corner of the screen showing the Taskanium UI.

**Verify:**
- Window stays on top when you switch to other apps
- Window has no title bar (frame: false)

---

## PHASE D — INSIGHTS PAGE

---

### D1 — Scaffold insights Vite app

**What:** Create a separate React app for the insights dashboard.

```powershell
# From project root
mkdir insights
cd insights
npm create vite@latest . -- --template react
npm install recharts
```

---

### D2 — Create `insights/src/App.jsx`

**What:** Dashboard that fetches `/insights` and shows charts.

**File to create:** `insights/src/App.jsx`

```jsx
import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from "recharts";

const API = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";
const COLORS = ["#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];

function StatCard({ label, value }) {
  return (
    <div style={{
      background: "#f5f3ff", borderRadius: 12, padding: "24px",
      textAlign: "center", flex: 1, minWidth: 140
    }}>
      <div style={{ fontSize: 36, fontWeight: 700, color: "#4f46e5" }}>{value}</div>
      <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{label}</div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/insights`)
      .then((r) => r.json())
      .then(setData)
      .catch(setError);
  }, []);

  if (error) return <div style={{ padding: 40, color: "red" }}>Failed to load insights</div>;
  if (!data) return <div style={{ padding: 40 }}>Loading…</div>;

  const abandonedData = Object.entries(data.abandoned_phases).map(([name, value]) => ({
    name, value
  }));
  const energyData = Object.entries(data.avg_duration_by_energy).map(([name, avg]) => ({
    name, avg
  }));

  return (
    <div style={{ fontFamily: "Inter, system-ui", padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontFamily: "monospace", fontSize: 28, marginBottom: 8 }}>TASKANIUM</h1>
      <p style={{ color: "#6b7280", marginBottom: 32 }}>Session Insights Dashboard</p>

      {/* Stat Cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 40, flexWrap: "wrap" }}>
        <StatCard label="Total Sessions" value={data.total_sessions} />
        <StatCard label="Completion Rate" value={`${Math.round(data.completion_rate * 100)}%`} />
        <StatCard label="Hyperfocus Sessions" value={data.hyperfocus_sessions} />
        <StatCard label="Avg Reminders" value={data.avg_reminders_per_session} />
      </div>

      {/* Sessions by Day */}
      <h2 style={{ fontFamily: "monospace", fontSize: 16, marginBottom: 12 }}>Sessions per Day</h2>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data.sessions_by_day}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Area type="monotone" dataKey="count" stroke="#6366f1" fill="#e0e7ff" />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ display: "flex", gap: 32, marginTop: 40, flexWrap: "wrap" }}>
        {/* Avg Duration by Energy */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <h2 style={{ fontFamily: "monospace", fontSize: 16, marginBottom: 12 }}>
            Avg Duration by Energy (min)
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={energyData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="avg" fill="#818cf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Abandoned by Phase */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <h2 style={{ fontFamily: "monospace", fontSize: 16, marginBottom: 12 }}>
            Abandoned by Phase
          </h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={abandonedData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {abandonedData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
```

**Verify:** `npm run dev` in `insights/` shows the dashboard. Charts render (may be empty if no sessions yet).

---

## PHASE E — DEPLOYMENT

---

### E1 — Create `.do/app.yaml`

**What:** DigitalOcean App Platform deployment config.

**File to create:** `.do/app.yaml`

```yaml
name: taskanium
region: nyc

services:
  - name: backend
    source_dir: backend
    github:
      repo: your-org/taskanium
      branch: main
      deploy_on_push: true
    run_command: uvicorn main:app --host 0.0.0.0 --port 8080
    environment_slug: python
    instance_count: 1
    instance_size_slug: basic-xxs
    http_port: 8080
    envs:
      - key: GEMINI_API_KEY
        scope: RUN_TIME
        type: SECRET
      - key: ELEVENLABS_API_KEY
        scope: RUN_TIME
        type: SECRET
      - key: ELEVENLABS_VOICE_ID
        scope: RUN_TIME
        value: "21m00Tcm4TlvDq8ikWAM"
      - key: SNOWFLAKE_ACCOUNT
        scope: RUN_TIME
        type: SECRET
      - key: SNOWFLAKE_USER
        scope: RUN_TIME
        type: SECRET
      - key: SNOWFLAKE_PASSWORD
        scope: RUN_TIME
        type: SECRET
      - key: SNOWFLAKE_DATABASE
        scope: RUN_TIME
        value: TASKANIUM_DB
      - key: SNOWFLAKE_SCHEMA
        scope: RUN_TIME
        value: PUBLIC
      - key: SNOWFLAKE_WAREHOUSE
        scope: RUN_TIME
        value: COMPUTE_WH
    health_check:
      http_path: /health

static_sites:
  - name: insights
    source_dir: insights
    github:
      repo: your-org/taskanium
      branch: main
      deploy_on_push: true
    build_command: npm install && npm run build
    output_dir: dist
    routes:
      - path: /insights
    envs:
      - key: VITE_API_URL
        scope: BUILD_TIME
        value: "https://taskanium.ondigitalocean.app"
```

**Verify:** File has `services` (backend) and `static_sites` (insights). Replace `your-org/taskanium` with actual repo.

---

### E2 — Create `README.md`

**What:** Project README for judges and GitHub.

**File to create:** `README.md`

```markdown
# Taskanium

> An AI focus companion built specifically for ADHD brains.

**Live Insights:** https://taskanium.ondigitalocean.app/insights
**Hackathon:** MLH AI Hackfest 2026 — April 2026

---

## What it does

Taskanium is an always-on-top desktop widget that helps people with ADHD start and stay on tasks.

- **One micro-step** — Gemini breaks your task into the smallest possible next action
- **Body doubling** — ElevenLabs voice creates a calming working-alongside experience
- **3-phase adaptive reminders** — More help at start, backs off when you're in flow
- **Hyperfocus detection** — Goes completely silent when you're deep in work
- **Doom spiral detection** — Escalates gently when you're stuck
- **Session memory** — Snowflake stores past sessions; Gemini learns and improves

## Tech Stack

| Layer | Technology |
|---|---|
| AI Planning | Google Gemini 1.5 Flash |
| Voice | ElevenLabs (Rachel voice) |
| Database | Snowflake |
| Deployment | DigitalOcean App Platform |
| Desktop | Electron (always-on-top) |
| Frontend | React + Vite + Tailwind + Framer Motion |
| Backend | FastAPI (Python) |

## Setup

### Backend
```bash
cd backend
cp .env.example .env
# Fill in your API keys in .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
npm install
npm run dev
```

### Electron (desktop widget)
```bash
cd electron
npm install
npm start -- --dev
```

## Environment Variables

See `backend/.env.example` for all required variables.

## Team

4-person team — MLH AI Hackfest 2026
```

---

## 🔍 FINAL VERIFICATION CHECKLIST

Run through this list before submitting:

```
Backend
[ ] GET  /health         → {"status":"ok"}
[ ] POST /start-session  → returns session_id, first_step, etc.
[ ] POST /speak          → returns audio_base64 + message_text
[ ] POST /end-session    → returns {"ok":true}
[ ] GET  /insights       → returns stats object

Frontend
[ ] npm run dev → UI loads at localhost:5173
[ ] TaskInput → typing task + clicking Start → calls real backend
[ ] ActiveSession → shows first_step from Gemini
[ ] Reminder fires after configured interval → voice plays
[ ] Done / Abandon buttons → calls /end-session

Electron
[ ] Window appears always-on-top
[ ] Window has no title bar (frame: false)
[ ] IPC: minimize-to-bubble shrinks window to 64×64
[ ] IPC: expand-to-panel restores to 320×420
[ ] IPC: open-insights opens browser

Snowflake
[ ] Sessions table exists
[ ] Row created on /start-session
[ ] Row updated on /end-session with ended_at
[ ] /insights returns real data

Deployment
[ ] Backend live on DigitalOcean: GET /health → 200
[ ] Insights page live at /insights URL
[ ] shell.openExternal opens insights in browser
```

---

## 🚨 RULES FOR AI AGENTS

1. **Do one step at a time.** Verify before moving on.
2. **Never hallucinate file paths.** Always check what exists first with `list_dir`.
3. **Never change the tech stack.** It's locked in `TASKANIUM_WORKFLOW.md`.
4. **Never put real API keys in code.** Use env vars only.
5. **If a step fails,** fix that step before moving to the next one.
6. **The source of truth** for all feature specs is `TASKANIUM_WORKFLOW.md`.
7. **Never delete existing files** in `src/` — only add or edit them.
8. **Backend port is 8000 locally.** Frontend is 5173.

---

*Guide version: 1.0 · AI Hackfest 2026 · Deadline: Apr 19 @ 7:30pm IST*
```
