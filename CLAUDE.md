# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Freshy is a Hackitba hackathon project — a household product inventory app with AI-powered recognition.

Two components:
- **Mobile app**: React Native + NativeWind UI
- **Backend/AI**: Python + FastAPI + Roboflow + Supabase (PostgreSQL)

## Backend

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in keys
uvicorn main:app --reload
```

API docs available at `http://localhost:8000/docs`.

### Environment variables (`backend/.env`)
- `ROBOFLOW_API_KEY` — from roboflow.com
- `SUPABASE_URL` / `SUPABASE_KEY` — from the Supabase project dashboard

## AI / Roboflow

Model used: **peng-majiz/fruit-b2sy0** (version 1)
- Detects fruits and their freshness state from images
- Inference via `https://detect.roboflow.com/fruit-b2sy0/1`
- Integration lives in `backend/services/fruit_detection.py`
- Exposed through `POST /detection/fruits` (multipart image upload)

## App features (to build)
- Camera → identify products (Roboflow)
- Spaces: fridge, pantry, etc. per household
- Expiration date tracking and renewal flow
- Product history and statistics (expired count, total stock, etc.)
- Fruit/vegetable freshness detection from photos
- Auto stock update when products are added/removed from spaces
