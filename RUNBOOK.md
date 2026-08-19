# InfluenceX — Operations & Production Runbook

> **Platform**: InfluenceX (NIAT Influencers Club Engagement, Credit & Attendance Ledger)  
> **Version**: 5.0.0 (Production Release)  
> **Timezone Standard**: `Asia/Kolkata` (IST, UTC+5:30)

---

## 1. System Architecture & Overview

InfluenceX is architected as an enterprise-grade digital ledger with dual-token authentication, append-only immutable audit streams, and server-time locked windows.

```
[ Frontend: React 18 + Vite + Tailwind + Recharts ]
                      │  (httpOnly secure cookies)
                      ▼
[ Backend: Express + TypeScript API Server (Node.js) ]
         │                │                │
         ▼                ▼                ▼
[ JWT Session Engine ]  [ Time Windows (IST) ] [ Excel Processing ]
         │                │                │
         └────────────────┼────────────────┘
                          ▼
            [ MongoDB Atlas Primary Cluster ]
            ├── Users & Students Directory
            ├── Events & Attendance Records
            ├── Append-Only Credit Ledger (TX-0000001)
            ├── Rewards & Real-time Stock Counters
            └── Immutable AuditLog Stream
```

---

## 2. Environment Variables Configuration

### Production Environment Variables (`server/.env.production`)

```env
NODE_ENV=production
PORT=5000
CLIENT_URL=https://influencex.niat.edu
MONGODB_URI=mongodb+srv://<USER>:<PASSWORD>@<CLUSTER>.mongodb.net/influencex?retryWrites=true&w=majority
JWT_ACCESS_SECRET=<64-char-random-hex-string>
JWT_REFRESH_SECRET=<64-char-random-hex-string>
DEFAULT_TIMEZONE=Asia/Kolkata
ADMIN_NAME=NIAT Administrator
ADMIN_EMAIL=admin@influencex.niat.edu
ADMIN_PASSWORD=<STRONG_RANDOM_PASSWORD>
```

### Frontend Production Variables (`client/.env.production`)

```env
VITE_API_URL=https://api-influencex.niat.edu/api
```

---

## 3. Deployment Guides

### A. Frontend Deployment (Recommended: **Vercel**)
**Why Vercel**:
- Native zero-config support for Vite + React SPAs.
- Edge CDN caching for ultra-fast load times across campus networks.
- Automatic SSL/TLS certificates and preview deployments.

**Deployment Steps**:
1. Connect GitHub repository to Vercel.
2. Set Root Directory to `client`.
3. Set Build Command to `npm run build` and Output Directory to `dist`.
4. Add environment variable: `VITE_API_URL = https://your-backend-domain.onrender.com/api`.
5. Add `vercel.json` rewrites for SPA client routing:
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

---

### B. Backend Deployment (Recommended: **Render**)
**Why Render**:
- First-class support for Dockerized and Node.js long-running web services.
- Persistent process execution required for background cron jobs (`node-cron`).
- Native HTTPS support with automatic certificate management.

**Deployment Steps**:
1. Create a new **Web Service** on Render pointing to the GitHub repository.
2. Set Root Directory to `server`.
3. Build Command: `npm install && npm run build`
4. Start Command: `npm start`
5. Configure Environment Variables in Render Dashboard (MongoDB URI, JWT Secrets, Admin credentials).
6. Set Health Check Path: `/api/health`.

---

## 4. Operational Procedures

### A. Seeding Initial Production Administrator
To provision the initial administrative account and seed core taxonomies:

```bash
cd server
npm run seed
```

This atomically seeds:
- Root Administrator account (`ADMIN_EMAIL`)
- 11 Standard Event Categories
- 13 Standard Credit Rules with point weights
- 5 Member Tier Thresholds (*Explorer 0, Rising 100, Creator 250, Leader 500, Icon 1000*)
- Initial Rewards Catalog Items
- First immutable `SYSTEM_ADMIN_SEEDED` AuditLog entry

---

### B. Manual Month-End Snapshot Trigger (If Cron Misses)
By default, the server runs a cron job on the last calendar day at `23:55 IST`. If server maintenance occurs during that window, trigger manually via API or UI:

**Via UI**:
1. Navigate to `/admin/leaderboard`.
2. Click **Record Month-End Snapshot** button in top right.

**Via CLI**:
```bash
curl -X POST https://api-influencex.niat.edu/api/leaderboard/snapshots/trigger \
  -H "Content-Type: application/json" \
  -b admin_cookies.txt \
  -d '{"month":"YYYY-MM"}'
```

---

### C. MongoDB Atlas Backup & Restore

#### 1. Automated Backups
MongoDB Atlas Cloud Backups run continuous snapshots (every 6 hours) with point-in-time recovery up to 7 days.

#### 2. Manual Export / Dump
```bash
mongodump --uri="mongodb+srv://<USER>:<PASS>@cluster.mongodb.net/influencex" --out=./backup-$(date +%F)
```

#### 3. Disaster Recovery Restore
```bash
mongorestore --uri="mongodb+srv://<USER>:<PASS>@cluster.mongodb.net/influencex" --drop ./backup-2026-08-15/influencex
```

---

## 5. Role & Permission Hierarchy Matrix

| Capability | ADMIN | EVENT_TEAM | FACULTY | STUDENT |
| :--- | :---: | :---: | :---: | :---: |
| **View Own Statement & Profile** | ✅ | ✅ | ✅ | ✅ |
| **Self-Register for Events** | ❌ | ❌ | ❌ | ✅ |
| **Claim Unlocked Goodies** | ❌ | ❌ | ❌ | ✅ |
| **Upload Excel Participant List** | ✅ | ✅ | ❌ | ❌ |
| **Mark Live Attendance** | ✅ | ✅ | ❌ | ❌ |
| **Record Workshop Participation** | ✅ | ✅ | ❌ | ❌ |
| **Bulk Award Credits** | ✅ | ✅ | ❌ | ❌ |
| **Approve 2nd-Step Corrections** | ✅ | ❌ | ❌ | ❌ |
| **Distribute Claimed Goodies** | ✅ | ✅ | ❌ | ❌ |
| **Configure Credit Rules & Tiers** | ✅ | ❌ | ❌ | ❌ |
| **Export Multi-Sheet Monthly Reports** | ✅ | ✅ | ✅ | ❌ |
| **Inspect Immutable Audit Stream** | ✅ | ❌ | ❌ | ❌ |
| **Modify or Delete Historical Records** | ⛔ NEVER | ⛔ NEVER | ⛔ NEVER | ⛔ NEVER |

---

## 6. Uptime Monitoring & Health Check

The backend exposes an unauthenticated health check endpoint:
```http
GET /api/health
```

**Response**:
```json
{
  "status": "healthy",
  "service": "InfluenceX API",
  "version": "5.0.0 (Phase 5 Final)",
  "timestamp": "2026-08-16T00:03:00.000Z"
}
```
Use this URL in UptimeRobot, BetterUptime, or Render Health Check probes.
