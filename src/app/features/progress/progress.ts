import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Progress, CompletionStatus } from '../../shared/models/progress.model';
import { Scenario, Difficulty, Theme } from '../../shared/models/scenario.model';

type SortField = 'title' | 'status' | 'score' | 'attempts' | 'time' | 'date';
type SortDir = 'asc' | 'desc';

interface ScenarioRow {
  progress: Progress;
  scenario: Scenario | null;
}

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './progress.html',
})
export class ProgressComponent implements OnInit {
  readonly CompletionStatus = CompletionStatus;
  readonly Difficulty = Difficulty;

  isLoading = signal(true);
  hasError  = signal(false);

  allProgress  = signal<Progress[]>([]);
  allScenarios = signal<Scenario[]>([]);

  sortField = signal<SortField>('date');
  sortDir   = signal<SortDir>('desc');

  // ── KPI cards ────────────────────────────────────────────
  kpis = computed(() => {
    const list = this.allProgress();
    const completed = list.filter(p =>
      p.status === CompletionStatus.COMPLETED_PASSED ||
      p.status === CompletionStatus.COMPLETED_FAILED
    );
    const passed = list.filter(p => p.status === CompletionStatus.COMPLETED_PASSED);
    const totalPts   = list.reduce((s, p) => s + (p.totalPointsEarned ?? 0), 0);
    const totalSecs  = list.reduce((s, p) => s + (p.timeSpentSeconds ?? 0), 0);
    const scores     = completed.filter(p => p.highestScore > 0).map(p => p.highestScore);
    const avgScore   = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const passRate   = completed.length ? Math.round((passed.length / completed.length) * 100) : 0;

    return {
      totalPoints:    totalPts,
      avgScore,
      passRate,
      timeSpent:      this.formatTotalTime(totalSecs),
      totalScenarios: list.length,
      passedCount:    passed.length,
      completedCount: completed.length,
      inProgressCount: list.filter(p => p.status === CompletionStatus.IN_PROGRESS).length,
    };
  });

  // ── Score trend sparkline points ──────────────────────────
  sparklinePoints = computed(() => {
    const completed = this.allProgress()
      .filter(p => p.completedAt && p.highestScore > 0)
      .sort((a, b) => new Date(a.completedAt!).getTime() - new Date(b.completedAt!).getTime())
      .slice(-20);

    if (completed.length < 2) return { points: '', dots: [], hasData: false };

    const W = 300, H = 60;
    const scores = completed.map(p => p.highestScore);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;

    const pts = completed.map((p, i) => {
      const x = (i / (completed.length - 1)) * W;
      const y = H - ((p.highestScore - min) / range) * H * 0.8 - H * 0.1;
      return { x, y, score: p.highestScore, title: p.scenarioTitle ?? '' };
    });

    const polyline = pts.map(p => `${p.x},${p.y}`).join(' ');
    return { points: polyline, dots: pts, hasData: true };
  });

  // ── Score distribution histogram (buckets: 0-49, 50-59, 60-69, 70-79, 80-89, 90-100) ──
  scoreDistribution = computed(() => {
    const buckets = [
      { label: '0–49',   min: 0,  max: 49,  count: 0, color: 'bg-red-500/60' },
      { label: '50–59',  min: 50, max: 59,  count: 0, color: 'bg-red-400/50' },
      { label: '60–69',  min: 60, max: 69,  count: 0, color: 'bg-vroom-amber/50' },
      { label: '70–79',  min: 70, max: 79,  count: 0, color: 'bg-vroom-amber/70' },
      { label: '80–89',  min: 80, max: 89,  count: 0, color: 'bg-vroom-green/60' },
      { label: '90–100', min: 90, max: 100, count: 0, color: 'bg-vroom-green/90' },
    ];
    const completed = this.allProgress().filter(p => p.highestScore > 0);
    for (const p of completed) {
      const bucket = buckets.find(b => p.highestScore >= b.min && p.highestScore <= b.max);
      if (bucket) bucket.count++;
    }
    const max = Math.max(...buckets.map(b => b.count), 1);
    return buckets.map(b => ({ ...b, pct: Math.round((b.count / max) * 100) }));
  });

  // ── Difficulty breakdown ──────────────────────────────────
  difficultyBreakdown = computed(() => {
    const scenarioMap = new Map(this.allScenarios().map(s => [s.id, s]));
    const counts = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0, UNKNOWN: 0 };
    const passed  = { BEGINNER: 0, INTERMEDIATE: 0, ADVANCED: 0, UNKNOWN: 0 };

    for (const p of this.allProgress()) {
      const s = scenarioMap.get(p.scenarioId);
      const d = (s?.difficulty as keyof typeof counts) ?? 'UNKNOWN';
      if (d in counts) {
        counts[d]++;
        if (p.status === CompletionStatus.COMPLETED_PASSED) passed[d]++;
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return [
      { label: 'Beginner',     key: 'BEGINNER',     count: counts.BEGINNER,     passedCount: passed.BEGINNER,     pct: Math.round((counts.BEGINNER / total) * 100),     color: '#10B981', trackColor: 'bg-vroom-green' },
      { label: 'Intermediate', key: 'INTERMEDIATE',  count: counts.INTERMEDIATE, passedCount: passed.INTERMEDIATE, pct: Math.round((counts.INTERMEDIATE / total) * 100), color: '#F59E0B', trackColor: 'bg-vroom-amber' },
      { label: 'Advanced',     key: 'ADVANCED',      count: counts.ADVANCED,     passedCount: passed.ADVANCED,     pct: Math.round((counts.ADVANCED / total) * 100),     color: '#FF4D1C', trackColor: 'bg-vroom-accent' },
    ].filter(d => d.count > 0);
  });

  difficultyDonut = computed(() => {
    const data = this.difficultyBreakdown();
    if (!data.length) return 'conic-gradient(#1E1E2E 0%, #1E1E2E 100%)';
    let accumulated = 0;
    const stops: string[] = [];
    for (const d of data) {
      stops.push(`${d.color} ${accumulated}%`);
      accumulated += d.pct;
      stops.push(`${d.color} ${accumulated}%`);
    }
    // fill remainder
    if (accumulated < 100) stops.push(`#1E1E2E ${accumulated}%`, `#1E1E2E 100%`);
    return `conic-gradient(${stops.join(', ')})`;
  });

  // ── Theme performance ─────────────────────────────────────
  themePerformance = computed(() => {
    const scenarioMap = new Map(this.allScenarios().map(s => [s.id, s]));
    const themeMap = new Map<string, { count: number; passed: number; totalScore: number }>();

    for (const p of this.allProgress()) {
      const s = scenarioMap.get(p.scenarioId);
      if (!s) continue;
      const key = s.theme;
      const entry = themeMap.get(key) ?? { count: 0, passed: 0, totalScore: 0 };
      entry.count++;
      if (p.status === CompletionStatus.COMPLETED_PASSED) entry.passed++;
      if (p.highestScore) entry.totalScore += p.highestScore;
      themeMap.set(key, entry);
    }

    return Array.from(themeMap.entries())
      .map(([theme, data]) => ({
        theme: theme as Theme,
        label: theme.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
        emoji: this.themeEmoji(theme as Theme),
        count: data.count,
        passRate: data.count ? Math.round((data.passed / data.count) * 100) : 0,
        avgScore: data.count ? Math.round(data.totalScore / data.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  });

  // ── Sortable progress table ───────────────────────────────
  sortedRows = computed(() => {
    const scenarioMap = new Map(this.allScenarios().map(s => [s.id, s]));
    const rows: ScenarioRow[] = this.allProgress().map(p => ({
      progress: p,
      scenario: scenarioMap.get(p.scenarioId) ?? null,
    }));

    const field = this.sortField();
    const dir   = this.sortDir();

    rows.sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (field) {
        case 'title':    va = a.progress.scenarioTitle ?? a.scenario?.title ?? ''; vb = b.progress.scenarioTitle ?? b.scenario?.title ?? ''; break;
        case 'status':   va = a.progress.status; vb = b.progress.status; break;
        case 'score':    va = a.progress.highestScore; vb = b.progress.highestScore; break;
        case 'attempts': va = a.progress.attemptCount; vb = b.progress.attemptCount; break;
        case 'time':     va = a.progress.timeSpentSeconds; vb = b.progress.timeSpentSeconds; break;
        case 'date':     va = new Date(a.progress.lastAccessedAt).getTime(); vb = new Date(b.progress.lastAccessedAt).getTime(); break;
        default:         va = 0; vb = 0;
      }
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return dir === 'asc' ? cmp : -cmp;
    });

    return rows;
  });

  // ── Recent activity feed ──────────────────────────────────
  recentActivity = computed(() =>
    [...this.allProgress()]
      .sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime())
      .slice(0, 8)
  );

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      progress:  this.http.get<Progress[]>(`${environment.apiUrl}/progress/my-progress`)
        .pipe(catchError(() => of([]))),
      scenarios: this.http.get<Scenario[]>(`${environment.apiUrl}/scenarios`)
        .pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ progress, scenarios }) => {
        this.allProgress.set(progress ?? []);
        this.allScenarios.set(scenarios ?? []);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.hasError.set(true); }
    });
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'date' ? 'desc' : 'asc');
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  statusLabel(s: CompletionStatus): string {
    switch (s) {
      case CompletionStatus.COMPLETED_PASSED: return 'Passed';
      case CompletionStatus.COMPLETED_FAILED: return 'Failed';
      case CompletionStatus.IN_PROGRESS:      return 'In Progress';
      default:                                return 'Not Started';
    }
  }

  statusBadge(s: CompletionStatus): string {
    switch (s) {
      case CompletionStatus.COMPLETED_PASSED: return 'bg-vroom-green/10 border-vroom-green/25 text-vroom-green';
      case CompletionStatus.COMPLETED_FAILED: return 'bg-red-500/10 border-red-500/25 text-red-400';
      case CompletionStatus.IN_PROGRESS:      return 'bg-vroom-amber/10 border-amber-500/25 text-vroom-amber';
      default:                                return 'bg-vroom-surface border-vroom-border text-vroom-muted';
    }
  }

  scoreColor(score: number): string {
    if (!score) return 'text-vroom-muted';
    return score >= 80 ? 'text-vroom-green' : score >= 60 ? 'text-vroom-amber' : 'text-red-400';
  }

  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-vroom-green'
      : d === Difficulty.INTERMEDIATE ? 'text-vroom-amber'
        : 'text-vroom-accent';
  }

  formatTime(secs: number): string {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  formatTotalTime(secs: number): string {
    if (!secs) return '0m';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  relativeTime(dateStr: string): string {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7)  return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  themeEmoji(theme: Theme): string {
    const map: Partial<Record<Theme, string>> = {
      [Theme.URBAN_DRIVING]: '🏙️', [Theme.HIGHWAY_DRIVING]: '🛣️',
      [Theme.PARKING]: '🅿️', [Theme.NIGHT_DRIVING]: '🌙',
      [Theme.WEATHER_CONDITIONS]: '🌧️', [Theme.DEFENSIVE_DRIVING]: '🛡️',
      [Theme.EMERGENCY_SITUATIONS]: '🚨', [Theme.INTERSECTIONS]: '✚',
      [Theme.PEDESTRIAN_SAFETY]: '🚶', [Theme.ROAD_SIGNS]: '🪧',
      [Theme.TRAFFIC_LAWS]: '⚖️', [Theme.VEHICLE_MAINTENANCE]: '🔧',
      [Theme.ECO_DRIVING]: '🌿', [Theme.MOUNTAIN_DRIVING]: '⛰️',
      [Theme.RURAL_DRIVING]: '🌾', [Theme.ROUNDABOUTS]: '🔄',
    };
    return map[theme] ?? '🚗';
  }

  sortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  skeletons = Array(6).fill(0);
}
