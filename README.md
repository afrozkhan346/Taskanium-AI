# Taskanium

> An AI focus companion built specifically for ADHD brains.

**Hackathon:** MLH AI Hackfest 2026 — April 2026

---

## What it does

Taskanium is an always-on-top desktop widget that helps people with ADHD start and stay on tasks.

- **One micro-step** — Groq breaks your task into the smallest possible next action
- **Body doubling** — ElevenLabs voice creates a calming working-alongside experience
- **3-phase adaptive reminders** — More help at start, backs off when you're in flow
- **Hyperfocus detection** — Goes completely silent when you're deep in work
- **Doom spiral detection** — Escalates gently when you're stuck
- **Session memory** — Snowflake stores past sessions; Groq learns and improves

## Tech Stack

| Layer         | Technology                        |
|---------------|-----------------------------------|
| AI Planning   | Groq (Llama 3 70B)                |
| Voice        | ElevenLabs (Rachel voice)         |
| Database     | Snowflake                         |
| Deployment   | App Platform         |
| Desktop      | Electron (always-on-top)          |
| Frontend     | React + Vite + Tailwind + Framer Motion |
| Backend      | FastAPI (Python)                  |

## Setup

### 1. Backend (Terminal 1)

```bash
cd backend
cp .env.example .env
# Fill in your GROQ, ElevenLabs, and Snowflake keys in .env
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

### 2. Frontend / Vite (Terminal 2)

```bash
npm install
npm run dev
```

### 3. Electron App (Terminal 3)

```bash
cd electron
npm install
npm run dev
```

## Environment Variables

See `backend/.env.example` for all required variables.

## Team

4-person team — MLH AI Hackfest 2026
