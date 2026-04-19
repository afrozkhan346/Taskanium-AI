import os
import base64
import httpx
from dotenv import load_dotenv

load_dotenv()

_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
_BASE_URL = "https://api.elevenlabs.io/v1"

# Voice config — Rachel: calm, warm, body-doubling feel
_VOICE_SETTINGS = {
    "stability": 0.75,
    "similarity_boost": 0.85,
}


def text_to_speech_base64(text: str) -> str:
    """
    Sends text to ElevenLabs TTS API.
    Returns base64-encoded MP3 string — ready to embed in JSON response.

    Frontend plays it with:
        const audio = new Audio(`data:audio/mp3;base64,${audio_base64}`)
        audio.play()
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
        "voice_settings": _VOICE_SETTINGS,
    }

    with httpx.Client(timeout=30) as client:
        response = client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        audio_bytes = response.content

    return base64.b64encode(audio_bytes).decode("utf-8")
