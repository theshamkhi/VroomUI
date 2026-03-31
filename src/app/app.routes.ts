import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard, dashboardRedirectGuard } from './core/guards/auth.guard';
import { Role } from './shared/models/user.model';

export const routes: Routes = [
  // Landing
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent)
  },

  // Auth routes
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login/login').then(m => m.LoginComponent)
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register/register').then(m => m.RegisterComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/forgot-password/forgot-password').then(m => m.ForgotPasswordComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/reset-password/reset-password').then(m => m.ResetPasswordComponent)
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./features/auth/verify-email/verify-email').then(m => m.VerifyEmailComponent)
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' }
    ]
  },

  // Fullscreen scenario player — no sidebar
  {
    path: 'scenarios/:id/play',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/scenarios/scenario-player/scenario-player').then(m => m.ScenarioPlayerComponent)
  },

  // Main app shell — sidebar layout
  // Uses 'app' as a non-conflicting parent path, then all children keep their original URLs
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-layout').then(m => m.DashboardLayoutComponent),
    children: [
      // ── Student ──
      {
        path: 'dashboard',
        canActivate: [dashboardRedirectGuard],
        loadComponent: () =>
          import('./features/dashboard/student-dashboard/student-dashboard').then(m => m.StudentDashboardComponent)
      },
      {
        path: 'scenarios',
        loadComponent: () => import('./features/scenarios/scenarios').then(m => m.ScenariosComponent)
      },
      {
        path: 'scenarios/:id',
        loadComponent: () =>
          import('./features/scenarios/scenario-detail/scenario-detail').then(m => m.ScenarioDetailComponent)
      },
      {
        path: 'scenarios/:id/results',
        loadComponent: () => import('./features/scenarios/results/results').then(m => m.ResultsComponent)
      },
      {
        path: 'progress',
        loadComponent: () => import('./features/progress/progress').then(m => m.ProgressComponent)
      },
      {
        path: 'my-badges',
        loadComponent: () => import('./features/my-badges/my-badges').then(m => m.MyBadgesComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent)
      },
      {
        path: 'assignments',
        loadComponent: () =>
          import('./features/assignments/assignments').then(m => m.StudentAssignmentsComponent)
      },

      // ── Instructor ──
      {
        path: 'dashboard/instructor',
        loadComponent: () =>
          import('./features/dashboard/instructor-dashboard/instructor-dashboard').then(m => m.InstructorDashboardComponent)
      },
      {
        path: 'instructor/scenarios',
        loadComponent: () =>
          import('./features/instructor/instructor-scenarios/instructor-scenarios').then(m => m.InstructorScenariosComponent)
      },
      {
        path: 'instructor/scenarios/new',
        loadComponent: () =>
          import('./features/instructor/scenario-editor/scenario-editor').then(m => m.ScenarioEditorComponent)
      },
      {
        path: 'instructor/scenarios/:id/edit',
        loadComponent: () =>
          import('./features/instructor/scenario-editor/scenario-editor').then(m => m.ScenarioEditorComponent)
      },
      {
        path: 'instructor/videos',
        loadComponent: () =>
          import('./features/instructor/instructor-videos/instructor-videos').then(m => m.InstructorVideosComponent)
      },
      {
        path: 'instructor/students',
        loadComponent: () =>
          import('./features/instructor/instructor-students/instructor-students').then(m => m.InstructorStudentsComponent)
      },
      {
        path: 'instructor/analytics',
        loadComponent: () =>
          import('./features/instructor/instructor-analytics/instructor-analytics').then(m => m.InstructorAnalyticsComponent)
      },
    ]
  },

  // Admin routes
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard([Role.ADMIN])],
    loadComponent: () =>
      import('./features/dashboard/dashboard-layout').then(m => m.DashboardLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/admin/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent)
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/admin/admin-users/admin-users').then(m => m.AdminUsersComponent)
      },
      {
        path: 'instructors',
        loadComponent: () =>
          import('./features/admin/admin-instructors/admin-instructors').then(m => m.AdminInstructorsComponent)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },

  { path: '**', redirectTo: '/' }
];