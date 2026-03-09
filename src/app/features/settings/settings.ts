import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { User, Role } from '../../shared/models/user.model';
import { Progress, CompletionStatus } from '../../shared/models/progress.model';

type SettingsTab = 'profile' | 'security' | 'account';
type PasswordStatus = 'idle' | 'sending' | 'sent' | 'error';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './settings.html',
})
export class SettingsComponent implements OnInit {
  readonly Role = Role;

  activeTab    = signal<SettingsTab>('profile');
  isLoadingUser = signal(false);
  user          = signal<User | null>(null);

  // ── Progress stats for profile card ──────────────────────
  progressStats = signal<{ total: number; passed: number; totalPts: number } | null>(null);

  // ── Password reset ────────────────────────────────────────
  passwordStatus  = signal<PasswordStatus>('idle');
  passwordError   = signal<string | null>(null);
  currentEmail    = computed(() => this.user()?.email ?? this.authService.currentUser()?.email ?? '');

  // ── Danger zone ───────────────────────────────────────────
  showLogoutConfirm  = signal(false);
  isLoggingOut       = signal(false);

  // ── Computed display helpers ──────────────────────────────
  initials = computed(() => {
    const u = this.user() ?? this.authService.currentUser();
    if (!u) return '?';
    return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
  });

  fullName = computed(() => {
    const u = this.user() ?? this.authService.currentUser();
    if (!u) return '';
    return `${u.firstName} ${u.lastName}`.trim();
  });

  roleBadge = computed(() => {
    switch (this.user()?.role ?? this.authService.currentUser()?.role) {
      case Role.STUDENT:    return { label: 'Student',    cls: 'bg-vroom-blue/10 border-blue-500/25 text-vroom-blue' };
      case Role.INSTRUCTOR: return { label: 'Instructor', cls: 'bg-vroom-accent/10 border-vroom-accent/25 text-vroom-accent' };
      case Role.ADMIN:      return { label: 'Admin',      cls: 'bg-purple-500/10 border-purple-500/25 text-purple-400' };
      default:              return { label: 'User',       cls: 'bg-vroom-surface border-vroom-border text-vroom-muted' };
    }
  });

  memberSince = computed(() => {
    const d = this.user()?.createdAt;
    if (!d) return '';
    return new Date(d).toLocaleDateString('en', { month: 'long', year: 'numeric' });
  });

  constructor(
    public authService: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.loadUser();
    const role = this.authService.currentUser()?.role;
    if (role === Role.STUDENT) {
      this.loadStats();
    } else {
      this.progressStats.set(null);
    }
  }

  loadUser(): void {
    this.isLoadingUser.set(true);
    this.authService.getCurrentUser()
      .pipe(catchError(() => of(null)))
      .subscribe(u => {
        if (u) this.user.set(u);
        else this.user.set(this.authService.currentUser());
        this.isLoadingUser.set(false);
      });
  }

  loadStats(): void {
    this.http.get<Progress[]>(`${environment.apiUrl}/progress/my-progress`)
      .pipe(catchError(() => of([])))
      .subscribe(list => {
        const passed   = list.filter(p => p.status === CompletionStatus.COMPLETED_PASSED).length;
        const totalPts = list.reduce((s, p) => s + (p.totalPointsEarned ?? 0), 0);
        this.progressStats.set({ total: list.length, passed, totalPts });
      });
  }

  // ── Tab navigation ────────────────────────────────────────
  setTab(t: string): void { this.activeTab.set(<"profile" | "security" | "account">t); }

  // ── Password reset via email ──────────────────────────────
  sendPasswordReset(): void {
    const email = this.currentEmail();
    if (!email || this.passwordStatus() === 'sending') return;

    this.passwordStatus.set('sending');
    this.passwordError.set(null);

    this.http.post<void>(`${environment.apiUrl}/auth/request-reset`, { email })
      .pipe(catchError(err => {
        this.passwordError.set(err?.error?.message ?? 'Failed to send reset email. Please try again.');
        this.passwordStatus.set('error');
        return of(null);
      }))
      .subscribe(result => {
        if (result !== null || this.passwordStatus() !== 'error') {
          // null means catchError didn't fire (void response treated as null by of())
          // check status wasn't already set to error
          if (this.passwordStatus() !== 'error') {
            this.passwordStatus.set('sent');
          }
        }
      });
  }

  resetPasswordForm(): void {
    this.passwordStatus.set('idle');
    this.passwordError.set(null);
  }

  // ── Logout ────────────────────────────────────────────────
  confirmLogout(): void  { this.showLogoutConfirm.set(true); }
  cancelLogout(): void   { this.showLogoutConfirm.set(false); }

  doLogout(): void {
    this.isLoggingOut.set(true);
    this.authService.logout();
  }

  // ── Helpers ───────────────────────────────────────────────
  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }
}
