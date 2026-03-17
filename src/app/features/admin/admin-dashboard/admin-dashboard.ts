import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminStatsDTO, AdminUserDTO, SpringPage } from '../../../shared/models/user.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboardComponent implements OnInit {
  private api = environment.apiUrl;

  isLoading = signal(true);
  hasError  = signal(false);

  stats        = signal<AdminStatsDTO | null>(null);
  recentUsers  = signal<AdminUserDTO[]>([]);

  kpis = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      {
        label: 'Total Users',
        value: s.totalUsers,
        sub: `${s.activeUsers} active`,
        icon: 'users',
        color: 'blue',
      },
      {
        label: 'Students',
        value: s.totalStudents,
        sub: `${s.totalActiveStudents} active`,
        icon: 'student',
        color: 'green',
      },
      {
        label: 'Instructors',
        value: s.totalInstructors,
        sub: s.pendingInstructors > 0 ? `${s.pendingInstructors} pending approval` : 'All approved',
        icon: 'instructor',
        color: s.pendingInstructors > 0 ? 'amber' : 'green',
        alert: s.pendingInstructors > 0,
      },
      {
        label: 'Scenarios Completed',
        value: s.totalScenariosCompleted,
        sub: `${s.averageStudentCompletionPercentage.toFixed(1)}% avg completion`,
        icon: 'scenarios',
        color: 'accent',
      },
    ];
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      stats: this.http.get<AdminStatsDTO>(`${this.api}/admin/stats`).pipe(catchError(() => of(null))),
      users: this.http.get<SpringPage<AdminUserDTO>>(`${this.api}/admin/users?page=0&size=8&sort=createdAt,desc`)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ stats, users }) => {
        this.stats.set(stats);
        this.recentUsers.set(users?.content ?? []);
        this.isLoading.set(false);
      },
      error: () => { this.hasError.set(true); this.isLoading.set(false); }
    });
  }

  roleColor(role: string): string {
    return role === 'ADMIN'      ? 'bg-vroom-accent/10 border-vroom-accent/25 text-vroom-accent'
      : role === 'INSTRUCTOR' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
        : 'bg-green-500/10 border-green-500/25 text-green-400';
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  relativeTime(d?: string): string {
    if (!d) return 'Never';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return this.formatDate(d);
  }

  initials(u: AdminUserDTO): string {
    return (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '');
  }
}
