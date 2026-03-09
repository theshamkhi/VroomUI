import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';

import { ScenarioService } from '../../../core/services/scenario.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { Scenario, Difficulty, Theme, Question } from '../../../shared/models/scenario.model';
import { Progress, CompletionStatus } from '../../../shared/models/progress.model';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-scenario-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './scenario-detail.html',
})
export class ScenarioDetailComponent implements OnInit {
  readonly Difficulty = Difficulty;
  readonly Theme = Theme;
  readonly CompletionStatus = CompletionStatus;

  isLoading = signal(true);
  isStarting = signal(false);
  hasError = signal(false);

  scenario = signal<Scenario | null>(null);
  progress = signal<Progress | null>(null);
  questions = signal<Question[]>([]);
  relatedScenarios = signal<Scenario[]>([]);

  // Computed CTA state
  ctaState = computed(() => {
    const p = this.progress();
    if (!p || p.status === CompletionStatus.NOT_STARTED) return 'start';
    if (p.status === CompletionStatus.IN_PROGRESS) return 'resume';
    return 'retry'; // passed or failed
  });

  ctaLabel = computed(() => {
    switch (this.ctaState()) {
      case 'start':  return 'Start Scenario';
      case 'resume': return 'Resume Scenario';
      case 'retry':  return 'Try Again';
    }
  });

  passingPct = computed(() => {
    const s = this.scenario();
    if (!s) return 0;
    return Math.round((s.passingScore / s.maxPoints) * 100);
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private scenarioService: ScenarioService,
    private dashboardService: DashboardService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  load(id: string): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      scenario:  this.scenarioService.getById(id).pipe(catchError(() => of(null))),
      progress:  this.http.get<Progress>(`${environment.apiUrl}/progress/scenarios/${id}`)
        .pipe(catchError(() => of(null))),
      questions: this.http.get<Question[]>(`${environment.apiUrl}/scenarios/${id}/questions`)
        .pipe(catchError(() => of([]))),
      related:   this.scenarioService.getPopular(6).pipe(catchError(() => of([]))),
    }).subscribe(({ scenario, progress, questions, related }) => {
      if (!scenario) { this.hasError.set(true); this.isLoading.set(false); return; }

      this.scenario.set(scenario);
      this.progress.set(progress);
      this.questions.set(questions ?? []);
      // Filter out self from related
      this.relatedScenarios.set((related ?? []).filter(r => r.id !== id).slice(0, 4));
      this.isLoading.set(false);
    });
  }

  startScenario(): void {
    const s = this.scenario();
    if (!s || this.isStarting()) return;
    this.isStarting.set(true);

    this.scenarioService.startScenario(s.id).pipe(
      catchError(() => of(null))
    ).subscribe(() => {
      this.isStarting.set(false);
      // Navigate to learning player (future page)
      this.router.navigate(['/scenarios', s.id, 'play']);
    });
  }

  // ── Display helpers ──────────────────────────────────

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

  themeLabel(theme: Theme): string {
    return theme.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-vroom-green'
      : d === Difficulty.INTERMEDIATE ? 'text-vroom-amber'
        : 'text-vroom-accent';
  }

  difficultyBg(d: Difficulty): string {
    return d === Difficulty.BEGINNER
      ? 'bg-vroom-green/10 border-vroom-green/25 text-vroom-green'
      : d === Difficulty.INTERMEDIATE
        ? 'bg-vroom-amber/10 border-amber-500/25 text-vroom-amber'
        : 'bg-vroom-accent/10 border-vroom-accent/25 text-vroom-accent';
  }

  themeGradient(theme: Theme): string {
    const map: Partial<Record<Theme, string>> = {
      [Theme.URBAN_DRIVING]:         '#0d1117, #161b22',
      [Theme.HIGHWAY_DRIVING]:       '#0a0e1a, #111827',
      [Theme.PARKING]:               '#111111, #1c1c1c',
      [Theme.NIGHT_DRIVING]:         '#040814, #0a0f2e',
      [Theme.WEATHER_CONDITIONS]:    '#0a1520, #0d2035',
      [Theme.DEFENSIVE_DRIVING]:     '#100a0a, #1a0f0f',
      [Theme.EMERGENCY_SITUATIONS]:  '#1a0505, #0f0303',
      [Theme.INTERSECTIONS]:         '#0d0d1f, #1a1a2e',
      [Theme.PEDESTRIAN_SAFETY]:     '#050f05, #0a1f0a',
      [Theme.ROAD_SIGNS]:            '#111100, #1f1f00',
      [Theme.TRAFFIC_LAWS]:          '#100010, #1a001a',
      [Theme.VEHICLE_MAINTENANCE]:   '#111108, #1c1c0a',
      [Theme.ECO_DRIVING]:           '#041204, #072007',
      [Theme.MOUNTAIN_DRIVING]:      '#050f0f, #0a1f1f',
      [Theme.RURAL_DRIVING]:         '#060f02, #0d1f04',
      [Theme.ROUNDABOUTS]:           '#0d000d, #1a001a',
    };
    return map[theme] ?? '#0A0A0F, #111118';
  }

  formatDuration(s: number): string {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  scoreColor(score: number): string {
    return score >= 80 ? 'text-vroom-green' : score >= 60 ? 'text-vroom-amber' : 'text-red-400';
  }

  scoreBg(score: number): string {
    return score >= 80
      ? 'bg-vroom-green/10 border-vroom-green/25 text-vroom-green'
      : score >= 60
        ? 'bg-vroom-amber/10 border-amber-500/25 text-vroom-amber'
        : 'bg-red-500/10 border-red-500/25 text-red-400';
  }

  relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const d = Math.floor(diff / 86400000);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
  }
}
