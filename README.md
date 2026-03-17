# Vroom 🚗💨

> **Interactive SaaS driving school platform** — built for students, instructors, and administrators.

Vroom is a full-featured, dark-themed web application powered by **Angular 21** and **Tailwind CSS**. It delivers a seamless, role-based experience across three distinct user portals: a student learning hub, a comprehensive instructor management suite, and a platform-wide admin console — all backed by a Spring Boot REST API with JWT authentication.

---

## ✨ Features

### 🎓 Student Portal
| Route | Description |
|---|---|
| `/dashboard` | Personalized dashboard — XP level, stats, assigned scenarios, recent activity, suggestions |
| `/scenarios` | Browse all published scenarios with difficulty/theme filters, search, grid/list views, and **Assigned** badges |
| `/scenarios/:id` | Scenario detail — description, difficulty, duration, questions overview |
| `/scenarios/:id/play` | **Fullscreen immersive player** — no sidebar, question-by-question flow, real-time scoring |
| `/scenarios/:id/results` | Post-completion results — score breakdown, correct/incorrect answers, points earned |
| `/assignments` | All instructor-assigned scenarios with status tabs (Pending / Overdue / Completed), due date urgency, and direct links |
| `/progress` | Full learning history — completion rates, scores, time spent per scenario |
| `/badges` | Earned badges showcase |
| `/settings` | Profile and preferences |

### 👨‍🏫 Instructor Portal
| Route | Description |
|---|---|
| `/dashboard/instructor` | Overview — student activity, assignment summaries, quick stats |
| `/instructor/scenarios` | Full scenario library — publish/unpublish toggle, search, status filters, **assign to student** modal |
| `/instructor/scenarios/new` | Rich scenario editor — metadata, difficulty, theme, questions, answers, video attachment |
| `/instructor/scenarios/:id/edit` | Edit existing scenarios |
| `/instructor/students` | Student roster — detail panel with progress tab + assignments tab, notes, **assign scenario** modal |
| `/instructor/videos` | Video library management — upload, preview, delete |
| `/instructor/analytics` | Platform analytics — KPI cards, activity bar chart, difficulty breakdown, top students, scenario performance table |

### 🛡️ Admin Console
| Route | Description |
|---|---|
| `/admin/dashboard` | Platform overview — total users, completion rates, pending approvals alert, recent signups, health bars |
| `/admin/users` | Full user table — paginated, searchable, role filter tabs, change role modal, activate/deactivate, delete |
| `/admin/instructors` | Instructor management — card grid, one-click **Approve / Suspend**, detail panel with full stats |

### 🔐 Auth
- JWT access + refresh token flow
- Email verification on registration
- Forgot / reset password
- Role-based route guards (`authGuard`, `guestGuard`, `roleGuard`)
- Automatic redirect to role-appropriate dashboard on login

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Angular 21](https://angular.dev/) — standalone components, signals, `@if` / `@for` control flow |
| Styling | [Tailwind CSS](https://tailwindcss.com/) — custom design tokens, dark theme |
| HTTP | Angular `HttpClient` with JWT interceptor |
| State | Angular Signals (`signal`, `computed`) — no NgRx |
| Routing | Angular Router — lazy-loaded standalone components |
| Forms | Angular `FormsModule` (template-driven) |
| Build | [Angular CLI](https://github.com/angular/angular-cli) |
| Backend | Spring Boot 3 REST API (separate repo) |

---

## 🎨 Design System

Vroom uses a custom dark theme built on top of Tailwind:

| Token | Value | Usage |
|---|---|---|
| `vroom-black` | `#0A0A0F` | Page backgrounds |
| `vroom-dark` | — | Sidebar, header surfaces |
| `vroom-surface` | — | Card inner surfaces |
| `vroom-card` | — | Card backgrounds |
| `vroom-border` | — | All borders |
| `vroom-accent` | `#FF4D1C` | Primary CTA, highlights |
| Amber | `#F59E0B` | Warnings, pending states |
| Green | `#10B981` | Success, passed states |
| Blue | `#3B82F6` | Info, instructor accents |

**Typography:**
- `Syne` — display headings (`font-display`)
- `DM Sans` — body text (`font-body`)
- `JetBrains Mono` — code / numeric values (`font-mono`)

**Stat numbers** always use `font-body font-bold tabular-nums` for consistent alignment.

---

## 📁 Project Structure

```
src/app/
├── core/
│   ├── guards/          # authGuard, guestGuard, roleGuard, dashboardRedirectGuard
│   ├── interceptors/    # JWT auth interceptor
│   └── services/        # AuthService, DashboardService, ScenarioService, ...
├── features/
│   ├── admin/           # AdminDashboard, AdminUsers, AdminInstructors
│   ├── assignments/     # StudentAssignments
│   ├── auth/            # Login, Register, ForgotPassword, ResetPassword, VerifyEmail
│   ├── badges/          # Badges showcase
│   ├── dashboard/       # StudentDashboard, InstructorDashboard, DashboardLayout
│   ├── instructor/      # InstructorScenarios, ScenarioEditor, InstructorStudents,
│   │                    #   InstructorVideos, InstructorAnalytics
│   ├── landing/         # Public landing page
│   ├── progress/        # Student progress history
│   ├── scenarios/       # Scenarios list, ScenarioDetail, ScenarioPlayer, Results
│   └── settings/        # Settings page
└── shared/
    ├── components/      # SidebarComponent, ...
    ├── models/          # user.model.ts, scenario.model.ts, progress.model.ts
    └── pipes/           # ProgressForScenarioPipe, ...
```

---

## 🔌 API

The frontend connects to a **Spring Boot 3** backend at `http://localhost:8080`.

Configure the base URL in:
```
src/environments/environment.ts        # development
src/environments/environment.prod.ts   # production
```

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api'
};
```

### Key endpoint groups

| Prefix | Access | Description |
|---|---|---|
| `/api/auth/**` | Public | Register, login, refresh, verify, reset |
| `/api/scenarios/**` | Authenticated | Scenario CRUD and browsing |
| `/api/progress/**` | Student / Instructor | Learning progress tracking |
| `/api/instructor/**` | Instructor | Students, assignments, analytics |
| `/api/admin/**` | Admin | Platform management |
| `/api/badges/**` | Authenticated | Badge definitions and earned badges |
| `/api/videos/**` | Instructor (write) | Video library |

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) LTS
- [npm](https://www.npmjs.com/)
- Backend API running at `localhost:8080` ([Vroom backend repo](https://github.com/theshamkhi/Vroom))

### Setup

```bash
# 1. Clone
git clone https://github.com/theshamkhi/VroomUI.git
cd VroomUI

# 2. Install dependencies
npm install

# 3. Start development server
npm start
```

Navigate to **[http://localhost:4200](http://localhost:4200)**.

### Build for production

```bash
npm run build
```

Output is in `dist/`. The app uses lazy-loaded routes so the initial bundle stays small.

---

## 👤 User Roles

Vroom has three roles, each with its own sidebar navigation and guarded routes:

| Role | Default redirect | Access |
|---|---|---|
| `STUDENT` | `/dashboard` | Student portal + assignments |
| `INSTRUCTOR` | `/dashboard/instructor` | Instructor portal (read student data, create scenarios, assign) |
| `ADMIN` | `/admin/dashboard` | Full platform access including user management |

Roles are stored in the JWT and enforced both client-side (route guards) and server-side (Spring Security `@PreAuthorize`).

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---