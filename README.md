# ⭐ TrackStar — Goal Setting & Tracking Portal

A full-stack web application for organizational goal management — from creation and alignment to quarterly check-ins and performance visibility.

## 🚀 Live Demo

**URL:** [https://goal-portal-react.onrender.com](https://goal-portal-react.onrender.com)

| Role | Employee ID | Password |
|------|-------------|----------|
| Admin | EMP001 | admin123 |
| Manager (Sales) | EMP002 | manager123 |
| Manager (Engineering) | EMP007 | manager123 |
| Employee (Sales) | EMP003 | emp123 |
| Employee (Engineering) | EMP008 | emp123 |

---

## 📋 Features

### Phase 1 — Goal Creation & Approval
- Employee-facing interface to create and submit Goal Sheets
- Select Thrust Area, define Goal Title/Description, assign UoM and Targets
- **Validation rules enforced:**
  - Total weightage = 100%
  - Minimum weightage per goal: 10%
  - Maximum 8 goals per employee
- Manager (L1) Approval Workflow with inline editing
- Shared Goals — Admin/Manager can push departmental KPIs to employees
- Goals locked after approval (Admin can unlock)

### Phase 2 — Achievement Tracking & Quarterly Check-ins
- Quarterly update interface (Q1–Q4) for logging actual achievements
- Status tracking: Not Started / On Track / Completed
- Auto-computed progress scores:

| UoM Type | Formula |
|----------|---------|
| Min (Numeric/%) | Achievement ÷ Target |
| Max (Numeric/%) | Target ÷ Achievement |
| Timeline | On time = 100%, late = 0% |
| Zero | 0 = 100%, else 0% |

- Manager Check-in module with structured comments
- **Quarterly window enforcement** — data entry restricted to active window

### Phase 3 — Reporting & Governance
- Achievement Report with CSV export
- Completion Dashboard (by department, check-in rates)
- Audit Trail — logs all changes (who, what, when)
- Department-filtered views (Admin sees all, Manager sees team, Employee sees self)

### Bonus Features
- **Escalation Module** — Rule-based engine detecting overdue actions with auto-notifications
- **Analytics Dashboard** — QoQ trends, goal distribution, completion heatmap, manager effectiveness
- **AI Smart Check-in Summary** — Auto-generated insights for managers (rule-based, no external API)
- **Shared Goals with sync** — Achievement updates by primary owner sync across all linked sheets

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│              CLIENT (Browser)                    │
│         React 18 + Tailwind CSS + Vite          │
│    Role-based UI (Employee/Manager/Admin)        │
└────────────────────┬────────────────────────────┘
                     │ REST API (JSON)
┌────────────────────┼────────────────────────────┐
│              FLASK SERVER (Python)               │
│  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │
│  │   Auth   │ │ Business │ │  AI Engine     │  │
│  │ Sessions │ │  Logic   │ │ (Rule-based)   │  │
│  └──────────┘ └──────────┘ └────────────────┘  │
│          Gunicorn (Production WSGI)             │
└────────────────────┬────────────────────────────┘
                     │
┌────────────────────┼────────────────────────────┐
│             SQLite DATABASE                      │
│   11 tables · Auto-created · Zero config        │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router 6, Tailwind CSS 3, Vite 6 |
| Backend | Flask 3, Python 3.11 |
| Database | SQLite (file-based, zero config) |
| Auth | Cookie-based sessions, role decorators |
| AI | Rule-based check-in summary engine |
| Deployment | Render (free tier), Gunicorn |
| Cost | **$0** |

---

## 📁 Project Structure

```
goal-portal-react/
├── client/                    # React Frontend
│   ├── src/
│   │   ├── App.jsx           # Router + auth guards
│   │   ├── api.js            # API helper
│   │   ├── context/          # AuthContext
│   │   ├── components/       # Layout, Sidebar
│   │   └── pages/            # 9 page components
│   ├── index.html
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                    # Flask Backend
│   ├── app.py                # All API endpoints (~1000 lines)
│   ├── database.py           # Schema + seed data
│   ├── scoring.py            # Score computation formulas
│   ├── requirements.txt
│   └── static/               # React build output (served by Flask)
├── .gitignore
├── render.yaml               # Render deployment config
└── build.sh                  # Build script
```

---

## 🚀 Running Locally

### Prerequisites
- Python 3.11+
- Node.js 18+

### Backend
```bash
cd server
pip install -r requirements.txt
python app.py
```
Server starts at `http://localhost:5000`

### Frontend (Development)
```bash
cd client
npm install
npm run dev
```
Dev server at `http://localhost:3000` (proxies API to Flask)

### Production Build
```bash
cd client
npm run build
cp -r dist/* ../server/static/
cd ../server
python app.py
```
Full app at `http://localhost:5000`

---

## 👥 Organization Hierarchy

```
EMP001 — Rajesh Kumar (VP & Head, ADMIN)
├── SALES (4 employees)
│   └── EMP002 — Priya Sharma (Manager)
│       ├── EMP003 — Amit Patel
│       ├── EMP004 — Sneha Reddy
│       ├── EMP005 — Ravi Kulkarni
│       └── EMP006 — Meera Joshi
├── ENGINEERING (5 employees)
│   └── EMP007 — Vikram Singh (Manager)
│       ├── EMP008 — Deepa Nair
│       ├── EMP009 — Arjun Mehta
│       ├── EMP010 — Pooja Desai
│       ├── EMP011 — Sanjay Rao
│       └── EMP012 — Nisha Verma
└── HR (2 employees)
    └── EMP013 — Kavitha Iyer (Manager)
        ├── EMP014 — Rohit Joshi
        └── EMP015 — Ananya Pillai
```

---

## 🔄 User Workflow

1. **Admin** creates cycle with quarterly windows
2. **Employee** creates goals → submits for approval
3. **Manager** reviews → approves (goals locked)
4. **Employee** logs quarterly achievements (within active window)
5. **Manager** conducts check-in → views AI summary → adds comment
6. **Admin** runs escalation engine → monitors reports & analytics

---

## 📊 API Endpoints (30+)

| Category | Endpoints |
|----------|-----------|
| Auth | `POST /login`, `/logout`, `GET /me` |
| Goals | `POST/PUT/DELETE /goals`, `/goal-sheets`, `/submit` |
| Approval | `GET/POST /manager/approvals`, `/approve`, `/return` |
| Achievements | `GET/POST /achievements` (window enforced) |
| Check-ins | `GET/POST /manager/checkins`, `/comment` |
| Admin | `/admin/*` (employees, cycles, thrust areas, shared goals, unlock) |
| Reports | `GET /reports`, `/reports/export` (CSV) |
| Analytics | `GET /analytics` (dept-filtered by role) |
| Escalation | `/escalation/run`, `/resolve`, `/rules` |
| AI | `GET /ai/checkin-summary/<id>` |

---

## 🔒 Security Features

- Password never returned in API responses
- Role-based access control on every endpoint
- Session cookies with `SameSite=Lax`, `HttpOnly=True`
- Audit trail for all post-lock changes
- Department-scoped data visibility

---

## 📈 Deployment

Hosted on **Render** (free tier):
- Runtime: Python 3
- Build: `pip install -r requirements.txt`
- Start: `gunicorn app:app --bind 0.0.0.0:$PORT`
- React build committed in `server/static/`

---

## 📄 License

MIT
