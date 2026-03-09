import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { Scenario, ScenarioStatus, Difficulty, Theme } from '../../../shared/models/scenario.model';
import { Video, VideoStatus } from '../../../shared/models/api.model';

@Component({
  selector: 'app-instructor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './instructor-dashboard.html',
})
export class InstructorDashboardComponent implements OnInit {
  readonly ScenarioStatus = ScenarioStatus;
  readonly VideoStatus    = VideoStatus;

  isLoading  = signal(true);
  hasError   = signal(false);

  scenarios  = signal<Scenario[]>([]);
  videos     = signal<Video[]>([]);

  // ── Publishing actions ────────────────────────────────────
  publishingId   = signal<string | null>(null);
  deletingId     = signal<string | null>(null);

  // ── KPIs ─────────────────────────────────────────────────
  kpis = computed(() => {
    const sc = this.scenarios();
    const vi = this.videos();
    return {
      total:     sc.length,
      published: sc.filter(s => s.status === ScenarioStatus.PUBLISHED).length,
      draft:     sc.filter(s => s.status === ScenarioStatus.DRAFT).length,
      archived:  sc.filter(s => s.status === ScenarioStatus.ARCHIVED).length,
      videos:    vi.length,
      readyVideos: vi.filter(v => v.status === VideoStatus.READY).length,
      totalCompletions: sc.reduce((sum, s) => sum + (s.completionCount ?? 0), 0),
      avgRating: (() => {
        const rated = sc.filter(s => s.averageRating > 0);
        return rated.length
          ? (rated.reduce((sum, s) => sum + s.averageRating, 0) / rated.length).toFixed(1)
          : null;
      })(),
    };
  });

  // ── Recent scenarios (last 6) ─────────────────────────────
  recentScenarios = computed(() =>
    [...this.scenarios()]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8)
  );

  // ── Onboarding checklist ──────────────────────────────────
  checklist = computed(() => {
    const sc = this.scenarios();
    const vi = this.videos();
    const steps = [
      {
        id: 'scenario',
        label: 'Create your first scenario',
        done: sc.length > 0,
        route: '/instructor/scenarios/new',
        cta: 'Create scenario',
      },
      {
        id: 'video',
        label: 'Upload a video',
        done: vi.length > 0,
        route: '/instructor/videos',
        cta: 'Upload video',
      },
      {
        id: 'questions',
        label: 'Add questions to a scenario',
        done: sc.some(s => s.status !== ScenarioStatus.DRAFT),
        route: '/instructor/scenarios',
        cta: 'Add questions',
      },
      {
        id: 'publish',
        label: 'Publish a scenario',
        done: sc.some(s => s.status === ScenarioStatus.PUBLISHED),
        route: '/instructor/scenarios',
        cta: 'Publish',
      },
    ];
    return steps;
  });

  checklistComplete = computed(() => this.checklist().every(s => s.done));
  checklistProgress = computed(() => {
    const done = this.checklist().filter(s => s.done).length;
    return Math.round((done / this.checklist().length) * 100);
  });

  constructor(
    public authService: AuthService,
    private http: HttpClient,
    private router: Router,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      scenarios: this.http.get<Scenario[]>(`${environment.apiUrl}/scenarios`)
        .pipe(catchError(() => of([]))),
      videos:    this.http.get<Video[]>(`${environment.apiUrl}/videos/my-videos`)
        .pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ scenarios, videos }) => {
        // Filter to scenarios created by current user
        const me = this.authService.currentUser();
        const myScenarios = me
          ? scenarios.filter(s => s.createdBy === me.id)
          : scenarios;
        this.scenarios.set(myScenarios);
        this.videos.set(videos ?? []);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.hasError.set(true); },
    });
  }

  // ── Quick publish / unpublish ─────────────────────────────
  togglePublish(scenario: Scenario, event: Event): void {
    event.stopPropagation();
    if (this.publishingId()) return;
    this.publishingId.set(scenario.id);

    const action = scenario.status === ScenarioStatus.PUBLISHED ? 'unpublish' : 'publish';
    this.http.post(`${environment.apiUrl}/scenarios/${scenario.id}/${action}`, {})
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.publishingId.set(null);
        this.load(); // refresh
      });
  }

  goToEditor(id: string, event: Event): void {
    event.stopPropagation();
    this.router.navigate(['/instructor/scenarios', id, 'edit']);
  }

  goToNew(): void {
    this.router.navigate(['/instructor/scenarios/new']);
  }

  // ── Display helpers ───────────────────────────────────────
  statusBadge(status: ScenarioStatus): string {
    switch (status) {
      case ScenarioStatus.PUBLISHED: return 'bg-vroom-green/10 border-vroom-green/25 text-vroom-green';
      case ScenarioStatus.DRAFT:     return 'bg-vroom-amber/10 border-amber-500/25 text-vroom-amber';
      case ScenarioStatus.ARCHIVED:  return 'bg-vroom-surface border-vroom-border text-vroom-muted';
    }
  }

  statusDot(status: ScenarioStatus): string {
    switch (status) {
      case ScenarioStatus.PUBLISHED: return 'bg-vroom-green';
      case ScenarioStatus.DRAFT:     return 'bg-vroom-amber';
      case ScenarioStatus.ARCHIVED:  return 'bg-vroom-muted';
    }
  }

  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-vroom-green'
      : d === Difficulty.INTERMEDIATE ? 'text-vroom-amber'
        : 'text-vroom-accent';
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

  skeletons = Array(4).fill(0);
}
