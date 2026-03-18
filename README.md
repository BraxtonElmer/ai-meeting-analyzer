# AI Meeting Analyzer

### Real-Time Meeting Intelligence Platform

AI Meeting Analyzer is an end-to-end platform that captures live meeting conversations and transforms them into structured, actionable knowledge.

It combines real-time transcription, summaries, task extraction, sentiment and speaker analytics, and contextual Q&A in one unified workflow. The architecture connects a meeting bot, streaming dashboard, and analysis services so teams can move from discussion to decisions with clarity.

## Tech Stack

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Express](https://img.shields.io/badge/Express-111111?style=for-the-badge&logo=express&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_AI-4285F4?style=for-the-badge&logo=google&logoColor=white)
![WebSocket](https://img.shields.io/badge/WebSocket-1F2937?style=for-the-badge&logo=socketdotio&logoColor=white)

## What It Does

- Captures live transcription events from a meeting bot.
- Streams transcription into the dashboard for real-time visibility.
- Generates meeting summaries and task extraction with Gemini.
- Runs analytics like speaker contribution, sentiment transitions, and agenda alignment.
- Provides chatbot-style Q&A over meeting context and transcript history.

## System Overview

```text
Google Meet / Audio Source
	   |
	   v
   meeting-bot (Python)
	   |
	   v
dashboard API (Express + WebSocket) ----> dashboard client (React)
	   |
	   +----> PostgreSQL / MySQL
	   |
	   +----> analysis service (Flask) for reports and charts
	   |
	   +----> Gemini-powered summary/task/chat flows
```

## Repository Structure

- `dashboard/`: Main product app (React frontend + Express backend + DB integration).
- `analysis/`: Python analysis scripts and Flask API used by dashboard reporting.
- `meeting-bot/`: Bot service that captures/forwards live transcription entries.
- `chatbot/`: Standalone Flask chatbot app for transcript-based questions.
- `meet-recording-transcripts/`: Experimental Google Meet integration utilities.
- `transcripts/`: Transcript processing experiments and helper scripts.

## Quick Start

### 1) Prerequisites

- Node.js 18+
- Python 3.10+
- PostgreSQL 14+ or MySQL 8+
- Gemini API key

### 2) Install Dependencies

```bash
# Dashboard (Node/TypeScript)
cd dashboard
npm install

# Analysis service (Python)
cd ../analysis/flask_app
pip install -r requirements.txt

# Meeting bot (Python)
cd ../../meeting-bot
pip install -r requirements.txt

# Optional chatbot module
cd ../chatbot
pip install -r requirements.txt
```

### 3) Configure Environment Variables

Use the templates in this repo:

- `dashboard/.env.example`
- `analysis/flask_app/.env.example`
- `meeting-bot/.env.example`
- `chatbot/config.example.py` (copy to `chatbot/config.py` for local use)

Minimum required variables across services:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `SESSION_SECRET`
- `BOT_API_KEY` (must match between dashboard and meeting-bot)

### 4) Initialize Database (Dashboard)

```bash
cd dashboard
npm run db:push
npm run db:seed
```

### 5) Start Services

Run each service in a separate terminal:

```bash
# Dashboard app (API + frontend integration)
cd dashboard
npm run dev

# Analysis API
cd analysis/flask_app
python app.py

# Meeting bot API
cd meeting-bot
python app.py
```

Default local ports:

- Dashboard: `http://localhost:5000`
- Analysis Flask API: `http://localhost:6000`
- Meeting bot API: `http://localhost:5050`

## Main Documentation

- Dashboard setup and module details: `dashboard/README.md`
- Flask integration details: `dashboard/FLASK_INTEGRATION.md`
- API catalog: `dashboard/API_ENDPOINTS.md`
- Bot integration guide: `dashboard/README-BOT.md`

## Security Notes

- Credentials and API keys must be loaded from environment variables only.
- Do not commit `.env`, session cookie dumps, or local debug logs.
- If a secret is exposed, rotate it immediately before redeploying.

## Current Status

This repository includes production-oriented modules plus some experimental subfolders. Core dashboard, analysis, and bot pipelines are the primary maintained path.

## License

This project is released under the MIT License. See `LICENSE`. 