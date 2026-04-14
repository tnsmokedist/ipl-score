# 🏏 All Star Group — IPL Scoreboard Platform

## Complete Build Guide

> **Last updated:** April 14, 2026  
> **Author:** Hitesh Patidar  
> **Repository:** https://github.com/tnsmokedist/ipl-score  
> **Live URL:** https://ipl-score.vercel.app (Vercel frontend)  
> **API URL:** https://ipl-score-l2c8.onrender.com (Render backend)

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Overview](#3-architecture-overview)
4. [Project Structure](#4-project-structure)
5. [Database Schema](#5-database-schema)
6. [Backend API Routes](#6-backend-api-routes)
7. [Frontend Pages](#7-frontend-pages)
8. [How We Built It — Step by Step](#8-how-we-built-it--step-by-step)
9. [Cloud Deployment](#9-cloud-deployment)
10. [Environment Variables](#10-environment-variables)
11. [How to Run Locally](#11-how-to-run-locally)
12. [How to Rebuild From Scratch](#12-how-to-rebuild-from-scratch)
13. [Key Design Decisions](#13-key-design-decisions)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What This App Does

A **player-vs-player IPL betting management platform** for the "All Star Group" cricket betting circle (8 players).

### Core Features
- **Weekly Draw System** — Every week, each betting player is assigned batting positions (1–4) for both teams. These positions determine which IPL batsman's runs count toward their score.
- **Auto-Fetch Scores** — Scrapes live scorecards from Cricbuzz (no API key needed!) to automatically fill in batsmen names and runs.
- **Winner Calculation** — The player whose assigned batsmen score the most combined runs wins the pot.
- **Settlement Reports** — Tracks who owes whom, weekly net balances, and payment confirmations.
- **Multi-User Admin** — ADMIN, CO_ADMIN, and VIEWER roles. Viewers can see scores; admins can manage everything.
- **Mobile-First** — Fully responsive with bottom navigation bar, touch-friendly UI, optimized for iPhone Safari.

### The Betting Logic
```
8 players × $100 bet each = $800 pot per match
Each player is assigned:
  - Position 1-4 from Team A (e.g., CSK's #3 batsman)
  - Position 1-4 from Team B (e.g., RCB's #2 batsman)
Combined runs = Team A batsman runs + Team B batsman runs
Highest combined runs → WINS the $800 pot
Tie → pot splits equally among tied winners
```

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | Next.js | 16.2.3 | React SSR + routing |
| **UI Library** | React | 19.2.4 | Component rendering |
| **Styling** | Tailwind CSS | 4.x | Utility-first CSS |
| **Icons** | Lucide React | 1.8.0 | SVG icon library |
| **PDF Generation** | jsPDF + AutoTable | 4.2.1 / 5.0.7 | Settlement report PDFs |
| **Backend Runtime** | Node.js + Express | 5.2.1 | REST API server |
| **TypeScript Runner** | tsx | 4.21.0 | Run .ts files directly (no compile step) |
| **ORM** | Prisma | 5.22.0 | Database queries + migrations |
| **Database** | PostgreSQL (Neon) | — | Cloud-hosted relational DB |
| **Web Scraping** | Cheerio | 1.2.0 | Parse Cricbuzz HTML |
| **Cron Jobs** | node-cron | 4.2.1 | Daily auto-fetch at 4 PM EST |
| **Frontend Hosting** | Vercel | — | Auto-deploy from GitHub |
| **Backend Hosting** | Render | Free tier | Auto-deploy from GitHub |
| **Version Control** | Git + GitHub | — | Source code management |

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                      USER (Browser)                      │
│                   iPhone / Desktop / etc                  │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS
                      ▼
┌─────────────────────────────────────────────────────────┐
│              VERCEL (Frontend Host)                       │
│         Next.js 16 — Server-Side Rendering               │
│                                                           │
│  Pages:                                                   │
│    /              → Homepage (pre-warms backend)          │
│    /login         → Admin login                           │
│    /dashboard     → Overview stats                        │
│    /dashboard/players     → Manage 8 betting players      │
│    /dashboard/draws       → Weekly draws + match scores   │
│    /dashboard/settlements → Payout reports + PDF export   │
│    /dashboard/settings    → Sync matches, seed data       │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API calls (fetch)
                      ▼
┌─────────────────────────────────────────────────────────┐
│              RENDER (Backend Host)                        │
│         Express + tsx (TypeScript runtime)                │
│                                                           │
│  API Routes:                                              │
│    /api/auth/*       → Login, accounts, passwords         │
│    /api/players/*    → CRUD betting players                │
│    /api/draws/*      → Weekly draws, match scores         │
│    /api/settings/*   → Sync Cricbuzz, seed data           │
│                                                           │
│  Cron: 4 PM EST daily → auto-fetch today's scores         │
└─────────────┬──────────────────┬────────────────────────┘
              │                  │
              ▼                  ▼
┌──────────────────┐   ┌─────────────────────┐
│  NEON PostgreSQL │   │   CRICBUZZ (scrape)  │
│  Cloud Database  │   │   m.cricbuzz.com     │
│                  │   │   No API key needed  │
│  Tables:         │   │                     │
│  - AdminUser     │   │   Provides:         │
│  - BettingPlayer │   │   - Match schedule  │
│  - IplMatch      │   │   - Live scorecards │
│  - WeeklyDraw    │   │   - Batting data    │
│  - WeeklyDrawEntry│  └─────────────────────┘
│  - MatchResult   │
│  - SystemSettings│
└──────────────────┘
```

---

## 4. Project Structure

```
cricket/
├── .gitignore
├── render.yaml                    # Render deployment config
│
├── backend/
│   ├── .env                       # Local env vars (gitignored)
│   ├── .env.example               # Template for env vars
│   ├── .gitignore
│   ├── package.json               # Backend dependencies
│   ├── tsconfig.json              # TypeScript config
│   ├── index.ts                   # ⭐ Express app entry point + CORS + cron
│   │
│   ├── lib/
│   │   └── prisma.ts              # Shared PrismaClient singleton
│   │
│   ├── prisma/
│   │   ├── schema.prisma          # ⭐ Database schema (7 models)
│   │   └── migrations/            # Auto-generated by Prisma
│   │
│   ├── routes/
│   │   ├── auth.ts                # Login, create account, reset password
│   │   ├── draws.ts               # Weekly draws, match scoring, settlements
│   │   ├── players.ts             # CRUD for betting players
│   │   ├── settings.ts            # Sync Cricbuzz, seed database
│   │   └── matchups.ts            # (Legacy, excluded from build)
│   │
│   ├── services/
│   │   └── cricketApi.ts          # ⭐ Cricbuzz scraper (schedule + scorecard)
│   │
│   └── setup_all_weeks.js         # One-time script to backfill weekly draws
│
├── frontend/
│   ├── .env.production            # Render backend URL for Vercel
│   ├── package.json               # Frontend dependencies
│   ├── next.config.ts             # Next.js config
│   ├── tsconfig.json              # TypeScript config
│   ├── postcss.config.mjs         # PostCSS (Tailwind)
│   │
│   ├── public/
│   │   └── ipl-hero.png           # Homepage hero image
│   │
│   └── src/
│       ├── app/
│       │   ├── globals.css        # ⭐ Full design system (glassmorphism, etc)
│       │   ├── layout.tsx         # Root layout + AuthProvider
│       │   ├── page.tsx           # Homepage (hero + pre-warm ping)
│       │   │
│       │   ├── login/
│       │   │   └── page.tsx       # Login page (server wake-up UX)
│       │   │
│       │   └── dashboard/
│       │       ├── layout.tsx     # ⭐ Sidebar + bottom nav + header
│       │       ├── page.tsx       # Dashboard overview
│       │       ├── players/page.tsx    # Player management
│       │       ├── draws/page.tsx      # ⭐ Weekly draws + scoring (largest file)
│       │       ├── settlements/page.tsx # Payout reports + PDF
│       │       └── settings/page.tsx   # Admin settings
│       │
│       ├── hooks/
│       │   └── useAuth.tsx        # Auth context (login/logout/user state)
│       │
│       ├── lib/
│       │   ├── api.ts             # Fetch wrapper (auto-auth, error handling)
│       │   └── utils.ts           # Utility functions
│       │
│       └── components/
│           └── ui/
│               └── button.tsx     # Reusable button component
```

---

## 5. Database Schema

### Models (7 tables)

```prisma
model AdminUser {
  id            String   @id @default(uuid())
  email         String   @unique
  name          String   @default("")
  password_hash String                        // Plain text (MVP — no bcrypt yet)
  role          String   @default("VIEWER")   // ADMIN | CO_ADMIN | VIEWER
  created_at    DateTime @default(now())
}

model BettingPlayer {
  id                 String   @id @default(uuid())
  name               String   @unique             // e.g. "Happy", "Nick", "Pintu"
  is_active          Boolean  @default(true)
  default_bet_amount Float    @default(100.0)
  total_winnings     Float    @default(0.0)        // Cumulative season winnings
  total_losses       Float    @default(0.0)        // Cumulative season losses
  net_balance        Float    @default(0.0)        // = winnings - losses
}

model IplMatch {
  id           String   @id @default(uuid())
  api_match_id String   @unique                    // "cb_12345" (Cricbuzz ID)
  date         DateTime
  team_a_name  String                              // "Chennai Super Kings"
  team_b_name  String                              // "Royal Challengers Bengaluru"
  venue        String   @default("")
  status       String   @default("UPCOMING")       // UPCOMING | PENDING | COMPLETED
  bet_amount   Float    @default(100.0)
}

model WeeklyDraw {
  id                String    @id @default(uuid())
  week_label        String    @unique              // "Apr 9 – Apr 15"
  week_start        DateTime                        // Wednesday 12:00 AM
  week_end          DateTime                        // Tuesday 11:59 PM
  payout_confirmed  Boolean   @default(false)
  payout_confirmed_at DateTime?
}

model WeeklyDrawEntry {
  id                String   @id @default(uuid())
  weekly_draw_id    String
  betting_player_id String
  team_a_position   Int      // 1-4 (batting order position)
  team_b_position   Int      // 1-4
  @@unique([weekly_draw_id, betting_player_id])
}

model MatchResult {
  id                String   @id @default(uuid())
  weekly_draw_id    String
  match_id          String
  betting_player_id String
  team_a_position   Int
  team_b_position   Int
  player_a_name     String   @default("")          // Filled by Cricbuzz scraper
  player_b_name     String   @default("")
  player_a_runs     Int      @default(0)
  player_b_runs     Int      @default(0)
  total_runs        Int      @default(0)           // = player_a_runs + player_b_runs
  is_winner         Boolean  @default(false)
  payout            Float    @default(0.0)
  payment_confirmed Boolean  @default(false)
  @@unique([match_id, betting_player_id])
}

model SystemSettings {
  id    String @id @default(uuid())
  key   String @unique
  value String
}
```

### Relationships
```
WeeklyDraw  ──< WeeklyDrawEntry >──  BettingPlayer
WeeklyDraw  ──< MatchResult     >──  BettingPlayer
IplMatch    ──< MatchResult
```

---

## 6. Backend API Routes

### Auth (`/api/auth`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/login` | Authenticate with email + password |
| POST | `/create-account` | Create ADMIN/CO_ADMIN/VIEWER account |
| GET | `/accounts` | List all accounts |
| PUT | `/reset-password/:id` | Change user's password |
| DELETE | `/accounts/:id` | Delete an account |
| GET | `/online` | List currently online users |

### Players (`/api/players`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | List all betting players |
| POST | `/` | Create a new player |
| PUT | `/:id` | Update player name/status |
| DELETE | `/:id` | Delete a player |

### Draws (`/api/draws`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/weeks` | List all weekly draws |
| GET | `/weeks/:weekId` | Get a specific week + results |
| POST | `/weeks` | Create a new weekly draw |
| PUT | `/weeks/:weekId` | Edit draw positions |
| GET | `/matches` | List all IPL matches |
| GET | `/match/:matchId` | Get results for a match |
| PUT | `/match/:matchId/scores` | Manually enter scores |
| POST | `/match/:matchId/auto-fetch` | Auto-fetch from Cricbuzz |
| PUT | `/confirm-payment/:resultId` | Confirm single payment |
| PUT | `/confirm-week-payout/:weekId` | Confirm entire week |
| PUT | `/unconfirm-week-payout/:weekId` | Reopen a week |
| GET | `/settlement` | Full settlement report |

### Settings (`/api/settings`)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/sync-matches` | Pull latest IPL schedule from Cricbuzz |
| POST | `/seed` | Seed players + admin + all matches |

### Cron Jobs
| Schedule | Timezone | Purpose |
|----------|----------|---------|
| `0 16 * * *` | America/New_York | Auto-fetch scores for today's completed matches |

---

## 7. Frontend Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `page.tsx` | Premium homepage with hero image, animated entrance, pre-warms backend |
| `/login` | `login/page.tsx` | Glassmorphic login card, shows server wake-up status |
| `/dashboard` | `dashboard/page.tsx` | Overview with stats cards, recent match results |
| `/dashboard/players` | `dashboard/players/page.tsx` | Add/edit/delete the 8 betting players |
| `/dashboard/draws` | `dashboard/draws/page.tsx` | ⭐ Main working page — create weekly draws, assign positions, auto-fetch scores, see winners |
| `/dashboard/settlements` | `dashboard/settlements/page.tsx` | Weekly P&L summaries, payment confirmations, PDF export |
| `/dashboard/settings` | `dashboard/settings/page.tsx` | Sync Cricbuzz matches, seed database, manage user accounts, quick guide |

---

## 8. How We Built It — Step by Step

### Phase 1: Architecture & Database Design
**Commit:** `1837cde` — Initial commit

1. Designed the betting system logic (positions 1–4, combined runs, pot calculation)
2. Chose the tech stack: Next.js 16 + Express + Prisma + PostgreSQL
3. Created the Prisma schema with 7 models
4. Set up the monorepo structure: `/backend` + `/frontend`

### Phase 2: Backend API
**Commit:** `b2a0e47` — Production deploy

1. Built Express server with CORS configuration
2. Created all REST API routes (auth, players, draws, settings)
3. Built the **Cricbuzz scraper** (`services/cricketApi.ts`):
   - Scrapes `m.cricbuzz.com` mobile site (no API key!)
   - Parses match schedule from series page
   - Extracts batting scorecards (positions 1–4 per team)
4. Implemented auto-settlement logic:
   - Highest combined runs = winner
   - Pot = $100 × number of players
   - Ties split evenly
5. Added `node-cron` for daily 4 PM EST auto-fetch
6. Initially used SQLite, later migrated to PostgreSQL (Neon)

### Phase 3: Frontend UI
**Commit:** `b2a0e47` — Production deploy

1. Initialized Next.js 16 with Tailwind CSS 4
2. Built the design system in `globals.css`:
   - Dark theme with glassmorphism
   - Custom CSS classes: `card-glass`, `btn-primary`, `sidebar-glass`
   - Smooth animations and hover effects
3. Created the `useAuth` hook (React Context for login state)
4. Created the `api.ts` fetch wrapper (auto-attaches JWT tokens)
5. Built all dashboard pages:
   - **Draws page** (25KB — the most complex): weekly draw creation, position assignment, auto-fetch, manual scoring
   - **Settlements page** (19KB): weekly grouped P&L, PDF generation
   - **Settings page** (22KB): Cricbuzz sync, account management
   - **Players page** (15KB): CRUD with inline editing

### Phase 4: Cloud Deployment
**Commits:** `597ef52` → `5eacbf3`

1. Created GitHub repo: `tnsmokedist/ipl-score`
2. Set up **Neon PostgreSQL** (free tier) for cloud database
3. Ran `npx prisma migrate deploy` to create tables in the cloud
4. Deployed **backend to Render**:
   - Created `render.yaml` config
   - Connected GitHub repo
   - Set `DATABASE_URL` and `FRONTEND_URL` env vars
   - Used `tsx` instead of `tsc` to avoid TypeScript compilation issues
5. Deployed **frontend to Vercel**:
   - Connected GitHub repo
   - Set root directory to `frontend/`
   - Set `NEXT_PUBLIC_API_URL` to Render URL
6. Fixed CORS: backend allows `*.vercel.app` origins
7. Fixed Vercel/Render URL resolution: client-side detects localhost vs production

### Phase 5: Mobile Optimization
**Commit:** `f629f5d` — iPhone/mobile compatibility

1. Added viewport meta tag with `viewport-fit: cover` for iOS notch
2. Fixed `background-attachment: fixed` (not supported on iOS Safari)
3. Used `min-h-dvh` instead of `100vh` (iOS address bar issue)
4. Added mobile bottom navigation bar
5. Made all tables horizontally scrollable on small screens
6. Ensured touch-friendly button sizes (min 44px)

### Phase 6: Homepage & UX
**Commit:** `29b93cc` — Premium IPL homepage

1. Generated custom hero image using AI
2. Built animated homepage with staggered entrance animations
3. Added "Season 2026 — LIVE NOW" badge
4. Stats row: Live Matches, Real-time Scores, Instant Payouts

### Phase 7: Feature Enhancements
**Commits:** `8586645` → `3e43c7b`

1. Added online user tracking (in-memory Map with 60s heartbeat)
2. Added user account management in Settings
3. Added "Edit" functionality for weekly draws
4. Added weekly payout confirmation/unconfirmation
5. Added PDF export for settlement reports
6. Moved quick guide to Settings page

### Phase 8: Performance
**Commit:** `4703266` — Faster login

1. Created Prisma singleton (`lib/prisma.ts`) — was creating 6 separate DB connections
2. Added backend pre-warm ping on homepage load
3. Added server status banner on login page ("Waking up server…" → "Server ready ✓")

---

## 9. Cloud Deployment

### Render (Backend)

**Dashboard:** https://dashboard.render.com

```yaml
# render.yaml
services:
  - type: web
    name: ipl-betting-api
    runtime: node
    region: ohio
    plan: free
    rootDir: backend
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: DATABASE_URL
        sync: false
      - key: FRONTEND_URL
        sync: false
      - key: NODE_ENV
        value: production
```

**How it builds:**
1. `npm install` — installs dependencies
2. `npm run build` → `npx prisma generate` — generates Prisma client
3. `npm start` → `npx tsx index.ts` — runs the server

**Free tier limitation:** Spins down after 15 min idle. Cold start = ~30–60 seconds.

### Vercel (Frontend)

**Dashboard:** https://vercel.com/dashboard

- **Framework:** Next.js (auto-detected)
- **Root directory:** `frontend/`
- **Build command:** `next build` (auto)
- **Environment variable:** `NEXT_PUBLIC_API_URL=https://ipl-score-l2c8.onrender.com`

### Neon (Database)

**Dashboard:** https://console.neon.tech

- **Provider:** Neon PostgreSQL (free tier)
- **Region:** Should match Render's region (Ohio / us-east)
- **Connection string format:**
  ```
  postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
  ```

---

## 10. Environment Variables

### Backend (`backend/.env`)
```env
# PostgreSQL connection string (Neon)
DATABASE_URL="postgresql://user:password@host/database?sslmode=require"

# Frontend URL for CORS
FRONTEND_URL="https://ipl-score.vercel.app"
```

### Frontend (`frontend/.env.production`)
```env
NEXT_PUBLIC_API_URL=https://ipl-score-l2c8.onrender.com
```

---

## 11. How to Run Locally

### Prerequisites
- Node.js 18+ installed
- Git installed

### Steps

```powershell
# 1. Clone the repo
git clone https://github.com/tnsmokedist/ipl-score.git
cd ipl-score

# 2. Set up the backend
cd backend
npm install
# Create .env file with DATABASE_URL (use Neon or local PostgreSQL)
npx prisma generate
npx prisma migrate deploy   # or: npx prisma db push
npm run dev                  # Starts on http://localhost:5000

# 3. Set up the frontend (new terminal)
cd frontend
npm install
npm run dev                  # Starts on http://localhost:3000
```

### Default Login
```
Email:    admin@cricket.local
Password: allstar
```

---

## 12. How to Rebuild From Scratch

If you ever need to recreate this project from zero:

### Step 1: Create the project folder
```powershell
mkdir cricket
cd cricket
git init
```

### Step 2: Create the backend
```powershell
mkdir backend; cd backend
npm init -y
npm install express cors dotenv @prisma/client node-cron cheerio tsx
npm install @types/express @types/cors @types/node @types/node-cron
npx prisma init
```
Then:
- Copy `schema.prisma` from this guide's Section 5
- Create `index.ts`, all route files, and `services/cricketApi.ts`
- Run `npx prisma migrate dev --name init`

### Step 3: Create the frontend
```powershell
cd ..; npx -y create-next-app@latest frontend --ts --tailwind --app --src-dir --eslint
cd frontend
npm install lucide-react jspdf jspdf-autotable
```
Then copy all page files and the design system (`globals.css`).

### Step 4: Deploy
1. Push to GitHub
2. Connect Render → points to `backend/` folder
3. Connect Vercel → points to `frontend/` folder
4. Create Neon database → paste connection string into Render env vars
5. Set `FRONTEND_URL` on Render, set `NEXT_PUBLIC_API_URL` on Vercel

### Step 5: Seed the database
Visit: `POST https://your-render-url.onrender.com/api/settings/seed`
This creates the 8 betting players, admin account, and syncs all IPL matches from Cricbuzz.

---

## 13. Key Design Decisions

| Decision | Why |
|----------|-----|
| **Cricbuzz scraping instead of API** | Free, no API key, reliable. Scrapes `m.cricbuzz.com` mobile site which has simpler HTML. |
| **`tsx` instead of `tsc` compilation** | Eliminates build step headaches on Render. Runs TypeScript directly. |
| **Mock JWT tokens** | Simple `mock-jwt-{role}-{userId}` format. Good enough for a private betting circle. Not for public use. |
| **Prisma singleton** | Avoids creating multiple DB connections on cold start. Critical for Render free tier. |
| **Pre-warm ping on page load** | Combats Render's 30–60s cold start. Server wakes up while user reads the homepage. |
| **Weekly draw model** | Positions stay the same for an entire week (Wed–Tue). Simpler than per-match assignment. |
| **Combined runs = winner** | Team A position runs + Team B position runs. Ensures both innings matter. |
| **In-memory online tracking** | Simple `Map<userId, lastSeen>`. Resets on server restart. Good enough for 8 users. |
| **No bcrypt for passwords** | MVP for a private group. Should add bcrypt if this goes public. |

---

## 14. Troubleshooting

| Problem | Solution |
|---------|----------|
| Login takes forever | Render cold start. The pre-warm ping should handle it. Wait for "Server ready" badge. |
| Cricbuzz scraper returns 0 matches | Cricbuzz may have changed their HTML structure. Check `services/cricketApi.ts` regex patterns. |
| `prisma generate` fails on Render | Make sure `prisma` AND `@prisma/client` are in `dependencies` (not `devDependencies`). |
| CORS errors | Check `FRONTEND_URL` env var on Render. Must match your Vercel domain exactly. |
| Vercel shows "500 Internal Server Error" | Usually means the backend is down or the API URL is wrong. Check `frontend/.env.production`. |
| Auto-fetch scores but all runs are 0 | Match scorecard may not be available yet. Wait until the match is fully complete. |
| Database connection refused | Check `DATABASE_URL` in Render env vars. Neon may have suspended the database if inactive 7+ days. |
| `tsx: command not found` on Render | Make sure `tsx` is in `dependencies`, not `devDependencies`. |

---

## Git Commit History

```
4703266 fix: faster login - Prisma singleton + server pre-warm on page load
3e43c7b feat: add edit option for manually created weekly draws
fc2fd35 feat: online user tracking, heartbeat for presence
8586645 feat: logout to homepage, user account in settings
29b93cc feat: add premium IPL homepage with hero image
f629f5d fix: iPhone/mobile compatibility - viewport, navigation, responsive
f608895 fix: use client directive + runtime URL resolution for Vercel
41e59ca fix: hardcode Render URL fallback for Vercel deploy
5eacbf3 fix: Render build: use tsx directly instead of tsc compilation
fd92ff8 fix: move typescript to prod deps for Render build
597ef52 add Render backend URL for Vercel frontend deployment
b2a0e47 production deploy: PostgreSQL, CORS, build scripts, full frontend
1837cde initial commit
```

---

*Built with ❤️ by All Star Group, April 2026*
