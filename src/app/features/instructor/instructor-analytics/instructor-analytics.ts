import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, catchError, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Scenario, Difficulty, ScenarioStatus, Assignment, AssignmentStatus } from '../../../shared/models/scenario.model';
import { Progress, CompletionStatus } from '../../../shared/models/progress.model';
import { Student } from '../../../shared/models/user.model';

type PeriodFilter = '7d' | '30d' | '90d' | 'all';

interface ScenarioStat {
  scenario: Scenario;
  passRate: number;
  avgScore: number;
  attempts: number;
  completions: number;
}

@Component({
  selector: 'app-instructor-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instructor-analytics.html',
})
export class InstructorAnalyticsComponent implements OnInit {
  readonly Difficulty = Difficulty;

  isLoading = signal(true);
  hasError  = signal(false);
  period    = signal<PeriodFilter>('30d');

  scenarios   = signal<Scenario[]>([]);
  students    = signal<Student[]>([]);
  allProgress = signal<Progress[]>([]);
  assignments = signal<Assignment[]>([]);

  // ── Filter progress by period ─────────────────────────────
  filteredProgress = computed(() => {
    const p   = this.period();
    const all = this.allProgress();
    if (p === 'all') return all;
    const cutoff = Date.now() - { '7d': 7, '30d': 30, '90d': 90 }[p] * 86400000;
    return all.filter(x => new Date(x.lastAccessedAt).getTime() >= cutoff);
  });

  // ── KPIs ──────────────────────────────────────────────────
  kpis = computed(() => {
    const fp  = this.filteredProgress();
    const sc  = this.scenarios();
    const st  = this.students();
    const as_ = this.assignments();

    const completed = fp.filter(p =>
      p.status === CompletionStatus.COMPLETED_PASSED ||
      p.status === CompletionStatus.COMPLETED_FAILED
    );
    const passed = fp.filter(p => p.status === CompletionStatus.COMPLETED_PASSED);

    const totalAttempts    = fp.reduce((s, p) => s + p.attemptCount, 0);
    const avgScore         = fp.length ? Math.round(fp.reduce((s, p) => s + p.highestScore, 0) / fp.length) : 0;
    const passRate         = completed.length ? Math.round((passed.length / completed.length) * 100) : 0;
    const totalTimeHrs     = Math.round(fp.reduce((s, p) => s + (p.timeSpentSeconds ?? 0), 0) / 3600);
    const publishedCount   = sc.filter(s => s.status === ScenarioStatus.PUBLISHED).length;
    const pendingAssign    = as_.filter(a => a.status === AssignmentStatus.PENDING).length;
    const overdueAssign    = as_.filter(a => a.status === AssignmentStatus.OVERDUE).length;

    return {
      totalAttempts, avgScore, passRate, totalTimeHrs,
      publishedCount, totalScenarios: sc.length,
      totalStudents: st.length, pendingAssign, overdueAssign,
    };
  });

  // ── Per-scenario stats ────────────────────────────────────
  scenarioStats = computed((): ScenarioStat[] => {
    const fp = this.filteredProgress();
    return this.scenarios().map(s => {
      const rows      = fp.filter(p => p.scenarioId === s.id);
      const completed = rows.filter(p =>
        p.status === CompletionStatus.COMPLETED_PASSED ||
        p.status === CompletionStatus.COMPLETED_FAILED
      );
      const passed   = rows.filter(p => p.status === CompletionStatus.COMPLETED_PASSED);
      const attempts = rows.reduce((sum, p) => sum + p.attemptCount, 0);
      const avgScore = rows.length ? Math.round(rows.reduce((sum, p) => sum + p.highestScore, 0) / rows.length) : 0;
      const passRate = completed.length ? Math.round((passed.length / completed.length) * 100) : 0;
      return { scenario: s, passRate, avgScore, attempts, completions: completed.length };
    }).sort((a, b) => b.attempts - a.attempts);
  });

  // ── Difficulty breakdown ──────────────────────────────────
  difficultyBreakdown = computed(() => {
    const sc = this.scenarios();
    const fp = this.filteredProgress();
    return [Difficulty.BEGINNER, Difficulty.INTERMEDIATE, Difficulty.ADVANCED].map(d => {
      const ids       = sc.filter(s => s.difficulty === d).map(s => s.id);
      const rows      = fp.filter(p => ids.includes(p.scenarioId));
      const completed = rows.filter(p =>
        p.status === CompletionStatus.COMPLETED_PASSED ||
        p.status === CompletionStatus.COMPLETED_FAILED
      );
      const passed = rows.filter(p => p.status === CompletionStatus.COMPLETED_PASSED);
      return {
        difficulty: d,
        count:    ids.length,
        attempts: rows.reduce((s, p) => s + p.attemptCount, 0),
        passRate: completed.length ? Math.round((passed.length / completed.length) * 100) : 0,
        avgScore: rows.length ? Math.round(rows.reduce((s, p) => s + p.highestScore, 0) / rows.length) : 0,
      };
    });
  });

  // ── Top students by points ────────────────────────────────
  topStudents = computed(() => {
    const fp = this.filteredProgress();
    return this.students()
      .map(s => {
        const rows     = fp.filter(p => p.studentId === s.id);
        const passed   = rows.filter(p => p.status === CompletionStatus.COMPLETED_PASSED).length;
        const points   = rows.reduce((sum, p) => sum + p.totalPointsEarned, 0);
        const avgScore = rows.length ? Math.round(rows.reduce((sum, p) => sum + p.highestScore, 0) / rows.length) : 0;
        return { student: s, passed, points, avgScore, attempts: rows.reduce((sum, p) => sum + p.attemptCount, 0) };
      })
      .filter(x => x.attempts > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5);
  });

  // ── Assignment counts ────────────────────────────────────
  assignmentCounts = computed(() => {
    const a = this.assignments();
    return {
      completed: a.filter(x => x.status === AssignmentStatus.COMPLETED).length,
      pending:   a.filter(x => x.status === AssignmentStatus.PENDING).length,
      overdue:   a.filter(x => x.status === AssignmentStatus.OVERDUE).length,
    };
  });

  // ── Activity bar chart ────────────────────────────────────
  activityBars = computed(() => {
    const fp   = this.filteredProgress();
    const days = this.period() === '7d' ? 7 : this.period() === '90d' ? 90 : 30;
    const buckets: number[] = Array(days).fill(0);
    const now = Date.now();
    fp.forEach(p => {
      const diff = Math.floor((now - new Date(p.lastAccessedAt).getTime()) / 86400000);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += p.attemptCount;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((v, i) => ({ value: v, pct: Math.round((v / max) * 100), index: i }));
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    // Step 1: load scenarios, students and assignments in parallel
    forkJoin({
      scenarios: this.http.get<Scenario[]>(`${environment.apiUrl}/scenarios`)
        .pipe(catchError(() => of([]))),
      students: this.http.get<Student[]>(`${environment.apiUrl}/instructor/students`)
        .pipe(catchError(() => of([]))),
      assignments: this.http.get<Assignment[]>(`${environment.apiUrl}/instructor/assignments`)
        .pipe(catchError(() => of([]))),
    }).pipe(
      // Step 2: fetch progress for every student in parallel
      switchMap(({ scenarios, students, assignments }) => {
        this.scenarios.set(scenarios ?? []);
        this.students.set(students ?? []);
        this.assignments.set(assignments ?? []);

        if (!students?.length) return of([]);

        return forkJoin(
          (students ?? []).map(s =>
            this.http.get<Progress[]>(`${environment.apiUrl}/progress/student/${s.id}`)
              .pipe(catchError(() => of([])))
          )
        );
      })
    ).subscribe({
      next: (progressArrays) => {
        const flat = (progressArrays as Progress[][]).flat();
        this.allProgress.set(flat);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  setPeriod(p: string): void { this.period.set(p as PeriodFilter); }

  // ── Helpers ───────────────────────────────────────────────
  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-green-400'
      : d === Difficulty.INTERMEDIATE ? 'text-amber-400'
        : 'text-vroom-accent';
  }

  difficultyBarColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'bg-green-400'
      : d === Difficulty.INTERMEDIATE ? 'bg-amber-400'
        : 'bg-vroom-accent';
  }

  passRateColor(rate: number): string {
    if (rate >= 70) return 'text-green-400';
    if (rate >= 40) return 'text-amber-400';
    return 'text-red-400';
  }

  passRateBarColor(rate: number): string {
    if (rate >= 70) return 'bg-green-400';
    if (rate >= 40) return 'bg-amber-400';
    return 'bg-red-400';
  }

  scoreColor(score: number): string {
    if (score >= 75) return 'text-green-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  }

  initials(s: Student): string {
    return `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase();
  }

  avatarColor(id: string): string {
    const colors = [
      'bg-vroom-accent/20 text-vroom-accent', 'bg-blue-500/20 text-blue-400',
      'bg-green-500/20 text-green-400', 'bg-amber-500/20 text-amber-400',
      'bg-purple-500/20 text-purple-400', 'bg-pink-500/20 text-pink-400',
    ];
    return colors[id.charCodeAt(0) % colors.length];
  }

  skeletons = Array(4).fill(0);
}
