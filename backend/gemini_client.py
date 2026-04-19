import os
import json
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.environ["GEMINI_API_KEY"])
_model = genai.GenerativeModel("gemini-2.0-flash")


def plan_session(task_text: str, energy_level: str, past_context: str) -> dict:
    """
    Calls Gemini to plan a focus session.

    Returns a dict with:
        first_step            – one micro-action, under 12 words
        estimated_minutes     – realistic int
        phase_boundaries      – [phase1_end_min, phase2_end_min]
        base_interval_minutes – 5 (low) / 15 (medium) / 25 (high)
        opening_voice_text    – warm 1-sentence opener
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

    # Strip markdown fences if Gemini wraps in ```json ... ```
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1]
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

    Returns a single string — the exact words ElevenLabs will speak.
    Never hardcoded, never repeated, never judgmental.
    """
    phase_labels = {0: "Start", 1: "Mid", 2: "End"}
    phase_tones = {
        0: "Warm and encouraging — they are still getting started.",
        1: "Brief check-in — they are in the middle of working.",
        2: "Minimal — they are almost done, don't break flow.",
    }
    doom_note = (
        " The user appears to be stuck or avoidant. "
        "Be gentle and present. Give permission to do the tiniest possible thing."
        if is_doom_spiral
        else ""
    )

    prompt = f"""You are the voice of Taskanium — a calm, warm AI companion for ADHD brains.

Task: {task_text}
Energy: {energy_level}
Session phase: {phase_labels[current_phase]} — {phase_tones[current_phase]}
Reminder number: {reminder_number}
Doom spiral active: {is_doom_spiral}{doom_note}

Write ONE short spoken sentence (10–20 words). Rules:
- Feel genuinely fresh — never sound like a template
- Warm and human, not robotic or corporate
- Never judgmental or pushy
- Vary your phrasing naturally across reminders
- Do NOT start with "Hey" if reminder_number > 1

Return ONLY the sentence. No quotes. No explanation."""

    response = _model.generate_content(prompt)
    return response.text.strip().strip('"').strip("'")
