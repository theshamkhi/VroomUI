import { Component, signal, computed, OnInit, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of, catchError, tap } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Progress, CompletionStatus, StudentBadge } from '../../../shared/models/progress.model';
import { Scenario, Difficulty, Assignment, AssignmentStatus } from '../../../shared/models/scenario.model';
import { ProgressForScenarioPipe } from '../../../shared/pipes/progress-for-scenario.pipe';

@Pipe({
  name: 'any',
  standalone: true
})
export class AnyPipe implements PipeTransform {
  transform(value: any): any {
    return value;
  }
}

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProgressForScenarioPipe, AnyPipe],
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
  currentLevel = computed(() => {
    const pts = this.totalPoints();
    if (pts >= 1500) return 6;
    if (pts >= 1000) return 5;
    if (pts >= 600) return 4;
    if (pts >= 300) return 3;
    if (pts >= 100) return 2;
    return 1;
  });

  nextThreshold = computed(() => {
    const pts = this.totalPoints();
    if (pts < 100) return 100;
    if (pts < 300) return 300;
    if (pts < 600) return 600;
    if (pts < 1000) return 1000;
    if (pts < 1500) return 1500;
    return null;
  });

  prevThreshold = computed(() => {
    const pts = this.totalPoints();
    if (pts >= 1500) return 1500;
    if (pts >= 1000) return 1000;
    if (pts >= 600) return 600;
    if (pts >= 300) return 300;
    if (pts >= 100) return 100;
    return 0;
  });

  pointsToNextLevel = computed(() => {
    const next = this.nextThreshold();
    return next ? next - this.totalPoints() : 0;
  });

  levelProgress = computed(() => {
    const next = this.nextThreshold();
    const prev = this.prevThreshold();
    if (!next) return 100;
    const range = next - prev;
    const progress = this.totalPoints() - prev;
    return Math.min(100, Math.max(0, (progress / range) * 100));
  });

  // Greet time
  greeting = computed(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  });

  protected getStudentBadgeBadgeId(sb: StudentBadge): string | undefined {
    const anySb = sb as any;
    return (
      sb.id ??
      sb.badgeId ??
      anySb.badge_id ??
      sb.badge?.id ??
      anySb.badge?.id
    );
  }

  protected readonly CompletionStatus = CompletionStatus;

  constructor(
    public authService: AuthService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    forkJoin({
      progress: this.dashboardService.getMyProgress().pipe(
        catchError(() => { this.progressError.set(true); return of([]); })
      ),
      badges: this.dashboardService.getMyBadges().pipe(
        catchError((err: any) => { 
          this.badgesError.set(true); 
          return of([] as StudentBadge[]); 
        })
      ),
      popular: this.dashboardService.getPopularScenarios(8).pipe(
        catchError(() => { this.scenariosError.set(true); return of([]); })
      ),
      assignments: this.dashboardService.getMyAssignments().pipe(
        catchError(() => { this.assignmentsError.set(true); return of([]); })
      ),
    }).subscribe({
      next: ({ progress, badges, popular, assignments }: { progress: Progress[], badges: StudentBadge[], popular: Scenario[], assignments: Assignment[] }) => {
        this.progressList.set(progress);
        this.badges.set(badges);
        this.popularScenarios.set(popular);
        this.assignments.set(assignments ?? []);
        this.isLoading.set(false);
      },
      error: (err) => {
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
