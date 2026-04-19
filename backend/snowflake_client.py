import os
import uuid
from typing import Optional
import snowflake.connector
from dotenv import load_dotenv

load_dotenv()


def _get_conn():
    """Opens a fresh Snowflake connection. Always close after use."""
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
    Called once at FastAPI startup in main.py.
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
    Inserts a new session row when a session starts.
    Returns the new session_id (UUID string).
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


def get_last_5_sessions() -> list[dict]:
    """
    Fetches up to 5 most recent completed sessions.
    Used to build Gemini context for adaptive planning.
    """
    sql = """
    SELECT task_text, energy_level, estimated_mins, actual_mins,
           completed, abandoned_at_phase, hyperfocus_detected
    FROM sessions
    WHERE ended_at IS NOT NULL
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
    Converts last 5 sessions into a readable string injected into Gemini prompt.
    If no sessions, returns a first-timer message.
    """
    if not sessions:
        return "No past sessions found. This is the user's first session."

    total = len(sessions)
    completed = sum(1 for s in sessions if s.get("completed"))
    abandoned_start = sum(
        1 for s in sessions if s.get("abandoned_at_phase") == "start"
    )
    hyperfocus_count = sum(1 for s in sessions if s.get("hyperfocus_detected"))

    lines = [
        f"Past session context ({total} recent sessions):",
        f"- Completed: {completed} of {total}",
    ]
    if abandoned_start:
        lines.append(f"- Abandoned at start phase: {abandoned_start} time(s) — suggest a smaller first step")
    if hyperfocus_count:
        lines.append(f"- Hyperfocus detected in {hyperfocus_count} session(s) — user can go deep when engaged")

    actual_times = [s["actual_mins"] for s in sessions if s.get("actual_mins")]
    if actual_times:
        avg = round(sum(actual_times) / len(actual_times), 1)
        lines.append(f"- Average actual session length: {avg} min")

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
    Updates a session row when ended (Done ✔ or Abandon ✘).
    Sets ended_at to current timestamp.
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
    Runs aggregation queries for the insights dashboard.
    Returns a dict matching InsightsResponse in models.py.
    """
    conn = _get_conn()
    try:
        cur = conn.cursor()

        # Total completed sessions
        cur.execute("SELECT COUNT(*) FROM sessions WHERE ended_at IS NOT NULL")
        total = cur.fetchone()[0]

        if total == 0:
            return {
                "total_sessions": 0,
                "completion_rate": 0.0,
                "avg_duration_by_energy": {"low": 0.0, "medium": 0.0, "high": 0.0},
                "sessions_by_day": [],
                "abandoned_phases": {"start": 0, "mid": 0, "end": 0},
                "hyperfocus_sessions": 0,
                "avg_reminders_per_session": 0.0,
            }

        # Completion rate
        cur.execute(
            "SELECT COUNT(*) FROM sessions WHERE completed = TRUE AND ended_at IS NOT NULL"
        )
        completed_count = cur.fetchone()[0]
        completion_rate = round(completed_count / total, 2)

        # Avg duration by energy level
        avg_by_energy = {}
        for energy in ("low", "medium", "high"):
            cur.execute(
                "SELECT AVG(actual_mins) FROM sessions WHERE energy_level = %s AND actual_mins IS NOT NULL",
                (energy,),
            )
            val = cur.fetchone()[0]
            avg_by_energy[energy] = round(float(val), 1) if val else 0.0

        # Sessions per day — last 14 days
        cur.execute(
            """
            SELECT DATE(started_at) AS day, COUNT(*) AS cnt
            FROM sessions
            WHERE started_at >= DATEADD(day, -14, CURRENT_TIMESTAMP())
            GROUP BY day
            ORDER BY day
            """
        )
        sessions_by_day = [
            {"date": str(row[0]), "count": row[1]} for row in cur.fetchall()
        ]

        # Abandoned by phase
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
        avg_reminders = round(float(cur.fetchone()[0] or 0), 1)

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
