import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Progress, CompletionStatus, StudentBadge } from '../../../shared/models/progress.model';
import { Scenario, Difficulty, Assignment, AssignmentStatus } from '../../../shared/models/scenario.model';
import { ProgressForScenarioPipe } from '../../../shared/pipes/progress-for-scenario.pipe';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProgressForScenarioPipe],
  templateUrl: './student-dashboard.html'
})
export class StudentDashboardComponent implements OnInit {

  // Loading states
  isLoading = signal(true);
  hasError = signal(false);

  // Per-section error flags for graceful degradation
  progressError = signal(false);
  badgesError = signal(false);
  scenariosError = signal(false);

  // Data signals
  progressList = signal<Progress[]>([]);
  badges = signal<StudentBadge[]>([]);
  popularScenarios = signal<Scenario[]>([]);

  assignments = signal<Assignment[]>([]);
  assignmentsError = signal(false);

  // Computed stats
  completedCount = computed(() =>
    this.progressList().filter(p =>
      p.status === CompletionStatus.COMPLETED_PASSED ||
      p.status === CompletionStatus.COMPLETED_FAILED
    ).length
  );

  inProgressCount = computed(() =>
    this.progressList().filter(p => p.status === CompletionStatus.IN_PROGRESS).length
  );

  totalPoints = computed(() =>
    this.progressList().reduce((sum, p) => sum + (p.totalPointsEarned ?? 0), 0)
  );

  averageScore = computed(() => {
    const completed = this.progressList().filter(p =>
      p.status === CompletionStatus.COMPLETED_PASSED ||
      p.status === CompletionStatus.COMPLETED_FAILED
    );
    if (!completed.length) return 0;
    return Math.round(completed.reduce((sum, p) => sum + p.highestScore, 0) / completed.length);
  });

  pendingAssignments = computed(() =>
    this.assignments().filter(a =>
      a.status === AssignmentStatus.PENDING || a.status === AssignmentStatus.OVERDUE
    ).sort((a, b) => {
      // overdue first, then by due date
      if (a.status === AssignmentStatus.OVERDUE && b.status !== AssignmentStatus.OVERDUE) return -1;
      if (b.status === AssignmentStatus.OVERDUE && a.status !== AssignmentStatus.OVERDUE) return 1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      return 0;
    })
  );

  readonly AssignmentStatus = AssignmentStatus;

  // Continue where you left off
  inProgressScenarios = computed(() =>
    this.progressList()
      .filter(p => p.status === CompletionStatus.IN_PROGRESS)
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
      .slice(0, 1)
  );

  // Recent completions for activity feed
  recentActivity = computed(() =>
    this.progressList()
      .filter(p => p.status !== CompletionStatus.NOT_STARTED)
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
      .slice(0, 5)
  );

  // Scenarios not yet started from popular list
  suggestedScenarios = computed(() => {
    const startedIds = new Set(this.progressList().map(p => p.scenarioId));
    return this.popularScenarios().filter(s => !startedIds.has(s.id)).slice(0, 3);
  });

  // Current level based on total points
  currentLevel = computed(() => Math.max(1, Math.floor(this.totalPoints() / 500) + 1));
  pointsToNextLevel = computed(() => 500 - (this.totalPoints() % 500));
  levelProgress = computed(() => ((this.totalPoints() % 500) / 500) * 100);

  // Greet time
  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  });

  readonly CompletionStatus = CompletionStatus;

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    // Each call is individually fault-tolerant — a 500 on one endpoint
    // won't blank the entire dashboard, it just leaves that section empty.
    forkJoin({
      progress: this.dashboardService.getMyProgress().pipe(
        catchError(() => { this.progressError.set(true); return of([]); })
      ),
      badges: this.dashboardService.getMyBadges().pipe(
        catchError(() => { this.badgesError.set(true); return of([]); })
      ),
      popular: this.dashboardService.getPopularScenarios(8).pipe(
        catchError(() => { this.scenariosError.set(true); return of([]); })
      ),
      assignments: this.dashboardService.getMyAssignments().pipe(
        catchError(() => { this.assignmentsError.set(true); return of([]); })
      ),
    }).subscribe({
      next: ({ progress, badges, popular, assignments }) => {
        this.progressList.set(progress);
        this.badges.set(badges);
        this.popularScenarios.set(popular);
        this.assignments.set(assignments ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.hasError.set(true);
      }
    });
  }

  retry(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.progressError.set(false);
    this.badgesError.set(false);
    this.scenariosError.set(false);
    this.assignmentsError.set(false);
    this.ngOnInit();
  }

  statusColor(status: CompletionStatus): string {
    switch (status) {
      case CompletionStatus.COMPLETED_PASSED: return 'text-vroom-green';
      case CompletionStatus.COMPLETED_FAILED: return 'text-red-400';
      case CompletionStatus.IN_PROGRESS: return 'text-vroom-amber';
      default: return 'text-vroom-muted';
    }
  }

  statusLabel(status: CompletionStatus): string {
    switch (status) {
      case CompletionStatus.COMPLETED_PASSED: return 'Passed';
      case CompletionStatus.COMPLETED_FAILED: return 'Failed';
      case CompletionStatus.IN_PROGRESS: return 'In Progress';
      default: return 'Not Started';
    }
  }

  statusDot(status: CompletionStatus): string {
    switch (status) {
      case CompletionStatus.COMPLETED_PASSED: return 'bg-vroom-green';
      case CompletionStatus.COMPLETED_FAILED: return 'bg-red-400';
      case CompletionStatus.IN_PROGRESS: return 'bg-vroom-amber animate-pulse';
      default: return 'bg-vroom-muted';
    }
  }

  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-vroom-green' :
      d === Difficulty.INTERMEDIATE ? 'text-vroom-amber' : 'text-vroom-accent';
  }

  difficultyBg(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'bg-vroom-green/10 border-vroom-green/20' :
      d === Difficulty.INTERMEDIATE ? 'bg-vroom-amber/10 border-amber-500/20' :
        'bg-vroom-accent/10 border-vroom-accent/20';
  }

  formatDuration(seconds: number): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return `${m} min`;
  }

  relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  scoreColor(score: number): string {
    if (score >= 80) return 'text-vroom-green';
    if (score >= 60) return 'text-vroom-amber';
    return 'text-red-400';
  }

}
