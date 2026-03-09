import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Scenario, Question, Theme, Difficulty } from '../../../shared/models/scenario.model';
import { Progress, CompletionStatus, StudentBadge } from '../../../shared/models/progress.model';

interface AnswerResult {
  questionId: string;
  selectedIds: string[];
  correct: boolean;
  pointsEarned: number;
  timeTaken: number;
}

interface QuestionRow {
  question: Question;
  result: AnswerResult | null;
  expanded: boolean;
}

@Component({
  selector: 'app-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './results.html',
})
export class ResultsComponent implements OnInit {
  readonly CompletionStatus = CompletionStatus;

  isLoading = signal(true);
  hasError  = signal(false);

  scenario        = signal<Scenario | null>(null);
  progress        = signal<Progress | null>(null);
  questions       = signal<Question[]>([]);
  relatedScenarios = signal<Scenario[]>([]);
  newBadges       = signal<StudentBadge[]>([]);

  // State passed from player (may be null if navigated directly)
  playerScore         = signal<number | null>(null);
  playerPointsEarned  = signal<number | null>(null);
  playerCorrectCount  = signal<number | null>(null);
  playerTotalQ        = signal<number | null>(null);
  playerResults       = signal<AnswerResult[]>([]);

  // Question accordion state
  questionRows = signal<QuestionRow[]>([]);

  // ── Derived display values ─────────────────────────────────
  displayScore = computed(() =>
    this.playerScore() ?? this.progress()?.latestScore ?? 0
  );

  displayPoints = computed(() =>
    this.playerPointsEarned() ?? this.progress()?.totalPointsEarned ?? 0
  );

  displayCorrect = computed(() =>
    this.playerCorrectCount() ?? this.progress()?.correctAnswers ?? 0
  );

  displayTotal = computed(() =>
    this.playerTotalQ() ?? this.progress()?.totalQuestions ?? 0
  );

  passed = computed(() => {
    const s = this.scenario();
    if (!s) return false;
    const threshold = Math.round((s.passingScore / s.maxPoints) * 100);
    return this.displayScore() >= threshold;
  });

  passingThreshold = computed(() => {
    const s = this.scenario();
    if (!s) return 70;
    return Math.round((s.passingScore / s.maxPoints) * 100);
  });

  accuracy = computed(() => {
    const t = this.displayTotal();
    return t ? Math.round((this.displayCorrect() / t) * 100) : 0;
  });

  // Ring animation target (drives conic-gradient)
  animatedScore = signal(0);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;

    // Pull router state from player
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state ?? history.state;
    if (state?.score !== undefined) {
      this.playerScore.set(state.score);
      this.playerPointsEarned.set(state.pointsEarned);
      this.playerCorrectCount.set(state.correctCount);
      this.playerTotalQ.set(state.totalQuestions);
      this.playerResults.set(state.results ?? []);
    }

    this.load(id);
  }

  load(scenarioId: string): void {
    this.isLoading.set(true);

    forkJoin({
      scenario:  this.http.get<Scenario>(`${environment.apiUrl}/scenarios/${scenarioId}`)
        .pipe(catchError(() => of(null))),
      progress:  this.http.get<Progress>(`${environment.apiUrl}/progress/scenarios/${scenarioId}`)
        .pipe(catchError(() => of(null))),
      questions: this.http.get<Question[]>(`${environment.apiUrl}/scenarios/${scenarioId}/questions`)
        .pipe(catchError(() => of([]))),
      related:   this.http.get<Scenario[]>(`${environment.apiUrl}/scenarios/popular?limit=5`)
        .pipe(catchError(() => of([]))),
      badges:    this.http.get<StudentBadge[]>(`${environment.apiUrl}/badges/my-badges`)
        .pipe(catchError(() => of([]))),
    }).subscribe(({ scenario, progress, questions, related, badges }) => {
      if (!scenario) { this.hasError.set(true); this.isLoading.set(false); return; }

      this.scenario.set(scenario);
      this.progress.set(progress);
      this.questions.set((questions ?? []).sort((a, b) => a.orderIndex - b.orderIndex));
      this.relatedScenarios.set((related ?? []).filter(r => r.id !== scenarioId).slice(0, 4));

      // Find newly earned badges (earned within last 5 minutes)
      const recentCutoff = Date.now() - 5 * 60 * 1000;
      this.newBadges.set(
        (badges ?? []).filter(sb => new Date(sb.earnedAt).getTime() > recentCutoff)
      );

      // Build question rows, cross-referenced with player results
      const resultsMap = new Map(this.playerResults().map(r => [r.questionId, r]));
      this.questionRows.set(
        (questions ?? []).sort((a, b) => a.orderIndex - b.orderIndex).map(q => ({
          question: q,
          result: resultsMap.get(q.id) ?? null,
          expanded: false,
        }))
      );

      this.isLoading.set(false);

      // Animate score ring after data loads
      setTimeout(() => this.animateScore(), 100);
    });
  }

  private animateScore(): void {
    const target = this.displayScore();
    const duration = 1200;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      this.animatedScore.set(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  toggleRow(index: number): void {
    this.questionRows.update(rows =>
      rows.map((r, i) => i === index ? { ...r, expanded: !r.expanded } : r)
    );
  }

  retryScenario(): void {
    const s = this.scenario();
    if (!s) return;
    this.http.post(`${environment.apiUrl}/progress/scenarios/${s.id}/start`, {})
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.router.navigate(['/scenarios', s.id, 'play']));
  }

  // ── Display helpers ───────────────────────────────────────
  scoreRing = computed(() => {
    const score = this.animatedScore();
    const color = this.passed()
      ? score >= 90 ? '#10B981' : '#10B981'
      : score >= 60 ? '#F59E0B' : '#FF4D1C';
    return `conic-gradient(${color} ${score}%, #1E1E2E ${score}%)`;
  });

  scoreColor = computed(() =>
    this.passed() ? 'text-vroom-green' : this.displayScore() >= 60 ? 'text-vroom-amber' : 'text-vroom-accent'
  );

  verdict = computed(() => {
    const s = this.displayScore();
    if (!this.passed()) {
      return s >= 60
        ? { title: 'So close!', subtitle: 'You almost had it. One more run and you\'ll nail it.', emoji: '💪' }
        : { title: 'Keep going', subtitle: 'Every attempt builds your skills. You\'ve got this.', emoji: '🔄' };
    }
    return s === 100
      ? { title: 'Perfect score!', subtitle: 'Flawless. You\'ve mastered this scenario.', emoji: '🌟' }
      : s >= 90
        ? { title: 'Excellent!', subtitle: 'Outstanding performance. You\'re a natural.', emoji: '🏆' }
        : { title: 'Scenario Passed!', subtitle: 'Great job! You\'re making real progress.', emoji: '🎉' };
  });

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

  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-vroom-green'
      : d === Difficulty.INTERMEDIATE ? 'text-vroom-amber'
        : 'text-vroom-accent';
  }

  themeGradient(theme: Theme): string {
    const map: Partial<Record<Theme, string>> = {
      [Theme.URBAN_DRIVING]: '#0d1117, #161b22', [Theme.HIGHWAY_DRIVING]: '#0a0e1a, #111827',
      [Theme.PARKING]: '#111111, #1c1c1c', [Theme.NIGHT_DRIVING]: '#040814, #0a0f2e',
      [Theme.WEATHER_CONDITIONS]: '#0a1520, #0d2035', [Theme.DEFENSIVE_DRIVING]: '#100a0a, #1a0f0f',
      [Theme.EMERGENCY_SITUATIONS]: '#1a0505, #0f0303', [Theme.INTERSECTIONS]: '#0d0d1f, #1a1a2e',
      [Theme.PEDESTRIAN_SAFETY]: '#050f05, #0a1f0a', [Theme.ROAD_SIGNS]: '#111100, #1f1f00',
      [Theme.TRAFFIC_LAWS]: '#100010, #1a001a', [Theme.VEHICLE_MAINTENANCE]: '#111108, #1c1c0a',
      [Theme.ECO_DRIVING]: '#041204, #072007', [Theme.MOUNTAIN_DRIVING]: '#050f0f, #0a1f1f',
      [Theme.RURAL_DRIVING]: '#060f02, #0d1f04', [Theme.ROUNDABOUTS]: '#0d000d, #1a001a',
    };
    return map[theme] ?? '#0A0A0F, #111118';
  }

  formatTime(secs: number): string {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  formatDuration(s: number): string {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  skeletons = Array(4).fill(0);
}
