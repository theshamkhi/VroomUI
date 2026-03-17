import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Assignment, AssignmentStatus } from '../../shared/models/scenario.model';

type TabFilter = 'ALL' | 'PENDING' | 'OVERDUE' | 'COMPLETED';

@Component({
  selector: 'app-student-assignments',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './assignments.html',
})
export class StudentAssignmentsComponent implements OnInit {
  readonly AssignmentStatus = AssignmentStatus;

  isLoading   = signal(true);
  hasError    = signal(false);
  assignments = signal<Assignment[]>([]);
  activeTab   = signal<TabFilter>('ALL');

  filtered = computed(() => {
    const tab = this.activeTab();
    const all = this.assignments();
    if (tab === 'ALL') return all;
    return all.filter(a => a.status === tab);
  });

  counts = computed(() => {
    const a = this.assignments();
    return {
      all:       a.length,
      pending:   a.filter(x => x.status === AssignmentStatus.PENDING).length,
      overdue:   a.filter(x => x.status === AssignmentStatus.OVERDUE).length,
      completed: a.filter(x => x.status === AssignmentStatus.COMPLETED).length,
    };
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.http.get<Assignment[]>(`${environment.apiUrl}/progress/my-assignments`)
      .pipe(catchError(() => { this.hasError.set(true); return of([]); }))
      .subscribe(data => {
        const sorted = (data ?? []).sort((a, b) => {
          const order: Record<string, number> = { OVERDUE: 0, PENDING: 1, COMPLETED: 2 };
          const oa = order[a.status] ?? 1;
          const ob = order[b.status] ?? 1;
          if (oa !== ob) return oa - ob;
          if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
        });
        this.assignments.set(sorted);
        this.isLoading.set(false);
      });
  }

  setTab(tab: string): void { this.activeTab.set(tab as TabFilter); }

  statusBadge(s: AssignmentStatus): string {
    return s === AssignmentStatus.COMPLETED ? 'bg-green-500/10 border-green-500/25 text-green-400'
      : s === AssignmentStatus.OVERDUE   ? 'bg-red-500/10 border-red-500/25 text-red-400'
        : 'bg-amber-500/10 border-amber-500/25 text-amber-400';
  }

  statusDot(s: AssignmentStatus): string {
    return s === AssignmentStatus.COMPLETED ? 'bg-green-400'
      : s === AssignmentStatus.OVERDUE   ? 'bg-red-400 animate-pulse'
        : 'bg-amber-400';
  }

  statusLabel(s: AssignmentStatus): string {
    return s === AssignmentStatus.COMPLETED ? 'Completed'
      : s === AssignmentStatus.OVERDUE   ? 'Overdue'
        : 'Pending';
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  relativeTime(d?: string): string {
    if (!d) return '—';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  daysUntilDue(d?: string): number | null {
    if (!d) return null;
    return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  }

  skeletons = Array(4).fill(0);
}
