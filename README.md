# Taskanium

> An AI focus companion built specifically for ADHD brains.

**Live Insights:** [Demo Insights Page](#)
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

| Layer         | Technology                        |
|--------------|-----------------------------------|
| AI Planning  | Google Gemini 1.5 Flash           |
| Voice        | ElevenLabs (Rachel voice)         |
| Database     | Snowflake                         |
| Deployment   | App Platform         |
| Desktop      | Electron (always-on-top)          |
| Frontend     | React + Vite + Tailwind + Framer Motion |
| Backend      | FastAPI (Python)                  |

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
