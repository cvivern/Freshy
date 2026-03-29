# Architecture Overview

Generate a comprehensive architecture overview of this project based on its current structure.

## Instructions

Analyze the codebase and produce a structured architecture document covering the following areas:

### 1. Project Summary
- Project name and purpose
- Tech stack overview:
  - **Frontend**: React Native with Expo SDK 54
  - **Backend**: FastAPI (Python)
- High-level description of what the app does

### 2. Frontend Architecture (React Native + Expo SDK 54)

Examine the frontend source code and document:

- **Directory structure**: Map out the main folders and their responsibilities
- **Navigation**: Identify the navigation library used (e.g., Expo Router, React Navigation) and describe the screen/route hierarchy
- **State management**: Identify how state is managed (Context API, Zustand, Redux, etc.)
- **Component structure**: Describe how components are organized (shared, screen-level, etc.)
- **Styling approach**: Identify the styling solution (StyleSheet, NativeWind, Tamagui, etc.)
- **Key dependencies**: List the most important packages from `package.json` and what they do

### 3. API Layer (`services/api.ts`)

Read and analyze `services/api.ts` thoroughly and document:

- **Base URL / environment config**: How is the API base URL configured?
- **HTTP client**: What library is used (fetch, axios, etc.) and how is it set up?
- **Authentication**: How are auth tokens attached to requests (headers, interceptors, etc.)?
- **Exported functions**: List every exported function with its signature and what endpoint it calls
- **Error handling**: Describe the error handling strategy
- **Types/interfaces**: List key TypeScript types or interfaces defined here

### 4. Backend Architecture (FastAPI)

Examine the backend source code and document:

- **Directory structure**: Map out the main folders and their responsibilities
- **Routers / endpoints**: List the main routers, their prefixes, and the endpoints they expose (method + path + brief description)
- **Database**: Identify the database (PostgreSQL, SQLite, MongoDB, etc.) and the ORM or query layer used (SQLAlchemy, Tortoise, etc.)
- **Authentication**: Describe the auth strategy (JWT, OAuth2, API keys, etc.)
- **Data models / schemas**: List the key Pydantic models or database models
- **Middleware**: List any middleware (CORS, logging, rate limiting, etc.)
- **Background tasks / workers**: Note any background tasks or queues if present
- **Key dependencies**: List the most important packages from `requirements.txt` or `pyproject.toml`

### 5. Frontend ↔ Backend Communication

Document the contract between the two layers:

- **Authentication flow**: Step-by-step from login to authenticated request
- **Endpoint mapping**: Match each function in `services/api.ts` to its corresponding FastAPI route
- **Data formats**: Describe the request/response JSON shapes for the most important endpoints
- **Error handling**: How are HTTP errors propagated from the backend to the UI?

### 6. Environment & Configuration

- List environment variables used on both frontend and backend
- Describe how secrets and config are managed (`.env`, `app.config.ts`, etc.)

### 7. Architecture Diagram (ASCII)

Draw a simple ASCII diagram showing the main components and how they relate:

```
┌─────────────────────────────────────┐
│        React Native (Expo SDK 54)   │
│  ┌──────────┐   ┌─────────────────┐ │
│  │  Screens │──▶│ services/api.ts │ │
│  └──────────┘   └────────┬────────┘ │
└───────────────────────────┼─────────┘
                            │ HTTP/REST
                ┌───────────▼─────────┐
                │      FastAPI        │
                │  ┌───────────────┐  │
                │  │    Routers    │  │
                │  └───────┬───────┘  │
                │  ┌───────▼───────┐  │
                │  │   Database    │  │
                │  └───────────────┘  │
                └─────────────────────┘
```

Expand or replace this diagram to accurately reflect the actual architecture.

### 8. Known Conventions & Patterns

Document any recurring patterns, conventions, or rules the team follows that are not immediately obvious from the code (e.g., naming conventions, folder rules, how new screens should be added, how new API endpoints should be wired up).

---

## Output Format

Write the result as a well-structured Markdown document. Save it to `ARCHITECTURE.md` at the root of the project.

Use clear headings, bullet lists, and code blocks where appropriate. Keep descriptions concise but complete enough that a new developer can orient themselves without reading all the source code.