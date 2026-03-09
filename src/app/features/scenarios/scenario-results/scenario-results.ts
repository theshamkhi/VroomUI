import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Scenario, Question, QuestionType } from '../../../shared/models/scenario.model';
import { Progress, CompletionStatus } from '../../../shared/models/progress.model';

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
  selector: 'app-scenario-results',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './scenario-results.html',
})
export class ScenarioResultsComponent implements OnInit {
  readonly CompletionStatus = CompletionStatus;
  readonly QuestionType = QuestionType;

  isLoading = signal(true);
  hasError  = signal(false);

  scenarioId = signal('');
  scenario   = signal<Scenario | null>(null);
  progress   = signal<Progress | null>(null);
  questions  = signal<Question[]>([]);

  // Passed via router state (fresh from player)
  routerScore        = signal<number | null>(null);
  routerPointsEarned = signal<number | null>(null);
  routerCorrectCount = signal<number | null>(null);
  routerTotalQ       = signal<number | null>(null);
  routerResults      = signal<AnswerResult[]>([]);

  expandedIds = signal<Set<string>>(new Set());

  // ── Display values — prefer router state, fallback to API ──
  score = computed(() => this.routerScore() ?? this.progress()?.latestScore ?? 0);
  pointsEarned = computed(() => this.routerPointsEarned() ?? this.progress()?.totalPointsEarned ?? 0);
  correctCount = computed(() => this.routerCorrectCount() ?? this.progress()?.correctAnswers ?? 0);
  totalQuestions = computed(() => this.routerTotalQ() ?? this.progress()?.totalQuestions ?? this.questions().length);

  passed = computed(() => {
    const s = this.scenario();
    if (!s) return false;
    return this.score() >= Math.round((s.passingScore / s.maxPoints) * 100);
  });

  passingPct = computed(() => {
    const s = this.scenario();
    return s ? Math.round((s.passingScore / s.maxPoints) * 100) : 0;
  });

  ringGradient = computed(() => {
    const pct = this.score();
    const color = this.passed() ? '#10B981' : '#FF4D1C';
    return `conic-gradient(${color} ${pct}%, #1E1E2E ${pct}%)`;
  });

  accuracy = computed(() => {
    const total = this.totalQuestions();
    return total ? Math.round((this.correctCount() / total) * 100) : 0;
  });

  avgTimeTaken = computed(() => {
    const results = this.routerResults();
    if (!results.length) return null;
    return Math.round(results.reduce((s, r) => s + r.timeTaken, 0) / results.length);
  });

  questionRows = computed((): QuestionRow[] => {
    const results = this.routerResults();
    const expanded = this.expandedIds();
    return this.questions().map(q => ({
      question: q,
      result: results.find(r => r.questionId === q.id) ?? null,
      expanded: expanded.has(q.id),
    }));
  });

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.scenarioId.set(id);

    // Router state from player
    const state = history.state ?? {};
    if (state['score'] != null) {
      this.routerScore.set(state['score']);
      this.routerPointsEarned.set(state['pointsEarned']);
      this.routerCorrectCount.set(state['correctCount']);
      this.routerTotalQ.set(state['totalQuestions']);
      this.routerResults.set(state['results'] ?? []);
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
    }).subscribe(({ scenario, progress, questions }) => {
      if (!scenario) { this.hasError.set(true); this.isLoading.set(false); return; }
      this.scenario.set(scenario);
      this.progress.set(progress);
      this.questions.set((questions ?? []).sort((a, b) => a.orderIndex - b.orderIndex));
      this.isLoading.set(false);
    });
  }

  toggleExpand(questionId: string): void {
    this.expandedIds.update(set => {
      const next = new Set(set);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  }

  expandAll():   void { this.expandedIds.set(new Set(this.questions().map(q => q.id))); }
  collapseAll(): void { this.expandedIds.set(new Set()); }
  retry():       void { this.router.navigate(['/scenarios', this.scenarioId(), 'play']); }

  // ── Helpers ───────────────────────────────────────────────
  scoreColor(score: number): string {
    return score >= 80 ? 'text-vroom-green' : score >= 60 ? 'text-vroom-amber' : 'text-red-400';
  }

  answerStateClass(answerId: string, row: QuestionRow): string {
    const isCorrect  = row.question.answers.find(a => a.id === answerId)?.isCorrect;
    const wasSelected = row.result?.selectedIds.includes(answerId);
    if (isCorrect && wasSelected)   return 'border-vroom-green bg-vroom-green/10 text-vroom-green';
    if (isCorrect && !wasSelected)  return 'border-vroom-green/30 bg-vroom-green/5 text-vroom-green/60';
    if (!isCorrect && wasSelected)  return 'border-red-400 bg-red-500/10 text-red-400';
    return 'border-vroom-border text-vroom-text-dim opacity-40';
  }

  answerMarker(answerId: string, row: QuestionRow): { icon: string; cls: string } {
    const isCorrect  = row.question.answers.find(a => a.id === answerId)?.isCorrect;
    const wasSelected = row.result?.selectedIds.includes(answerId);
    if (isCorrect && wasSelected)   return { icon: '✓', cls: 'bg-vroom-green text-white border-vroom-green' };
    if (isCorrect && !wasSelected)  return { icon: '✓', cls: 'bg-transparent text-vroom-green border-vroom-green/40' };
    if (!isCorrect && wasSelected)  return { icon: '✗', cls: 'bg-red-500 text-white border-red-500' };
    return { icon: '',  cls: 'bg-transparent border-vroom-border/40' };
  }

  formatTime(secs: number): string {
    if (!secs) return '—';
    return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`;
  }

  skeletons = Array(5).fill(0);
}
