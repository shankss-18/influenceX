# InfluenceX — NIAT Influencers Club Platform

> **Full 5-Phase Enterprise Student Engagement, Digital Credit Ledger & Attendance Platform**  
> **Production Release (v5.0.0)**

---

## 🏛️ Project Architecture & Overview

**InfluenceX** is a private, production-ready student engagement platform built for the **NIAT Influencers Club**.

It delivers:
1. **Security & Custom Auth**:
   - Dual-token JWT rotation (`accessToken` in 15m httpOnly cookie, `refreshToken` in 7d httpOnly cookie).
   - Brute-force defense with `express-rate-limit`.
   - Role-Based Access Control (`ADMIN`, `EVENT_TEAM`, `FACULTY`, `STUDENT`).
2. **Deterministic Sequence & Taxonomy**:
   - Unique sequential identifiers (`IX-000001` for Students, `IXE-YYYY-NNN` for Events, `TX-0000001` for Transactions).
   - 11 Event Categories & 13 Configurable Credit Rules.
3. **Server-Time Locked Windows & Excel Ingestion**:
   - `Asia/Kolkata` server-enforced time windows for Registration, Attendance, and Credits.
   - Server-side dry-run Excel validation (`exceljs` + `multer`) with downloadable error reports.
4. **Append-Only Digital Credit Ledger**:
   - Immutable `CreditTransaction` records with schema-level prevention of updates/deletes.
   - Live ledger summation with dynamic tier recalculation (*Explorer 0, Rising 100, Creator 250, Leader 500, Icon 1000*).
   - 4-step deterministic leaderboard sorting & immutable monthly ranking snapshots.
   - Rewards & Goodies inventory system with race-safe atomic decrements (`availableQuantity >= 0`).
5. **Real-Time Analytics & Multi-Sheet Reporting**:
   - Real-time KPI aggregation dashboard with interactive `recharts` visualizations and 60s in-memory caching.
   - 7-sheet executive monthly Excel workbook generator (*Summary, Students, Credit Ledger, Attendance, Events, Rewards, Rankings*).
   - Read-only searchable AuditLog stream inspector.

---

## 🚀 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Recharts, Lucide Icons, Axios, React Router v6 |
| **Backend** | Node.js, Express, TypeScript, Mongoose, Zod, Dayjs (`Asia/Kolkata`), ExcelJS, Multer, Node-Cron, Express-Rate-Limit |
| **Database** | MongoDB Atlas Primary Cluster |
| **Auth** | Custom JWT (Dual-token `httpOnly` secure cookies with rotation, bcrypt) |

---

## 📁 Monorepo Structure

```
influenceX/
├── client/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── layout/             # AppLayout, Sidebar, Topbar
│   │   │   └── ui/                 # 11 Reusable Enterprise SaaS UI Components
│   │   ├── context/                # AuthContext, ToastContext
│   │   ├── pages/
│   │   │   ├── AdminDashboardPage.tsx       # Live KPIs, Recharts & Action Queues
│   │   │   ├── AdminAuditLogsPage.tsx       # Read-only Audit Log Inspector
│   │   │   ├── admin/
│   │   │   │   ├── AdminStudentsPage.tsx
│   │   │   │   ├── AdminStudentDetailPage.tsx # Overview, Credits Ledger, Ranks, Rewards
│   │   │   │   ├── AdminEventsPage.tsx
│   │   │   │   ├── AdminEventDetailPage.tsx   # Participants, Attendance, Participation, Credits Wizard
│   │   │   │   ├── AdminLeaderboardPage.tsx   # All-Time / Monthly Leaderboard & Snapshots
│   │   │   │   ├── AdminRewardsPage.tsx       # Goodies Catalog & Claims Queue
│   │   │   │   ├── AdminReportsPage.tsx       # Multi-Sheet Monthly Excel Exporter
│   │   │   │   ├── AdminCreditRulesPage.tsx   # 13 standard rules configuration
│   │   │   │   ├── AdminLevelsPage.tsx        # 5 tier threshold points configuration
│   │   │   │   ├── AdminEventCategoriesPage.tsx
│   │   │   │   └── AdminUsersPage.tsx
│   │   │   ├── student/
│   │   │   │   ├── StudentDashboardPage.tsx
│   │   │   │   ├── StudentEventsPage.tsx
│   │   │   │   ├── StudentCreditsPage.tsx     # Verified statement & points breakdown
│   │   │   │   ├── StudentLeaderboardPage.tsx # Personal standing & global rankings
│   │   │   │   └── StudentRewardsPage.tsx     # Goodies store & claim tracker
│   │   │   ├── LoginPage.tsx
│   │   │   ├── ProfilePage.tsx
│   │   │   ├── ForbiddenPage.tsx
│   │   │   └── NotFoundPage.tsx
│   │   └── types/
├── server/
│   ├── src/
│   │   ├── config/                 # db.ts, env.ts, timezone.ts (Asia/Kolkata)
│   │   ├── controllers/            # auth, student, event, category, time, import, attendance, participation, export, credit, creditRule, level, leaderboard, reward, analytics, report, audit
│   │   ├── middleware/             # requireAuth, requireRole, rateLimiter, errorHandler
│   │   ├── models/                 # User, AuditLog, Student, Event, EventCategory, EventRegistration, Counter, ExcelImport, Attendance, ParticipationRecord, CreditRule, CreditTransaction, LevelThreshold, MonthlyRankingSnapshot, Reward, RewardClaim
│   │   ├── routes/                 # auth, user, student, event, category, time, credit, creditRule, level, leaderboard, reward, analytics, report, audit
│   │   ├── utils/                  # jwt, audit, timezone, sequence, window, excel, multer, ledger, cron
│   │   └── seed.ts                 # Seeds Admin, Categories, Rules, Tiers, Rewards
├── RUNBOOK.md                      # Complete production operations & deployment guide
├── test_phase5_e2e.mjs             # Phase 5 Golden Flow 13-step end-to-end verification
├── test_security_hardening.mjs     # Security & rate limiting test suite
├── test_phase4.mjs                 # Phase 4 ledger & rewards test suite
├── test_phase3.mjs                 # Phase 3 Excel & attendance test suite
├── test_phase2.mjs                 # Phase 2 student & event taxonomy test suite
├── test_api.mjs                    # Phase 1 auth & audit test suite
└── README.md
```

---

## 🛠️ Quick Start & Setup

### 1. Database Seeding
```bash
npm run seed
```

### 2. Run Local Development Servers
```bash
# Start backend on http://localhost:5000
npm run dev:server

# Start frontend on http://localhost:5173
npm run dev:client
```

### 3. Run Automated Verification Tests
```bash
# Full 13-step golden lifecycle verification
node test_phase5_e2e.mjs

# Security hardening and rate limiting test
node test_security_hardening.mjs
```

---

## 🔐 Default Seed Credentials

| Role | Email | Password |
| :--- | :--- | :--- |
| **System Admin** | `admin@influencex.niat.edu` | `Admin@123456` |
| **Demo Student** | `student.demo@influencex.niat.edu` | `Student@123456` |

---

## 📖 Production Operations Runbook

See [`RUNBOOK.md`](file:///c:/Users/OMEN/OneDrive/Desktop/influenceX/RUNBOOK.md) for:
- Environment variable configuration (`.env.production`)
- Vercel (Frontend) & Render (Backend) deployment steps
- Emergency admin seeding & disaster recovery procedures
- Role & permission matrix
- Uptime monitoring health check (`GET /api/health`)
