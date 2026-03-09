import {
  Component, signal, computed, OnInit, OnDestroy,
  ViewChild, ElementRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, catchError, interval, Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  Scenario, Question, InteractionPoint, QuestionType
} from '../../../shared/models/scenario.model';
import { SubmitAnswerRequest } from '../../../shared/models/progress.model';
import { Video } from '../../../shared/models/api.model';
import { AuthService } from '../../../core/services/auth.service';

type PlayerPhase = 'loading' | 'error' | 'playing' | 'question' | 'feedback' | 'completed';

interface AnswerResult {
  questionId: string;
  selectedIds: string[];
  correct: boolean;
  pointsEarned: number;
  timeTaken: number;
}

@Component({
  selector: 'app-scenario-player',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './scenario-player.html',
})
export class ScenarioPlayerComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoElRef!: ElementRef<HTMLVideoElement>;

  readonly QuestionType = QuestionType;

  // ── State machine ──────────────────────────
  phase = signal<PlayerPhase>('loading');

  // ── Data ───────────────────────────────────
  scenario = signal<Scenario | null>(null);
  questions = signal<Question[]>([]);
  interactionPoints = signal<InteractionPoint[]>([]);
  video = signal<Video | null>(null);
  blobVideoUrl = signal<string | null>(null);

  // ── Playback state ─────────────────────────
  currentTime = signal(0);
  duration = signal(0);
  isPlaying = signal(false);
  isMuted = signal(false);
  volume = signal(1);
  showControls = signal(true);
  private controlsTimer: ReturnType<typeof setTimeout> | null = null;
  private lastVideoTime = 0;

  // ── Question state ─────────────────────────
  activeQuestion = signal<Question | null>(null);
  activeIP = signal<InteractionPoint | null>(null);
  selectedAnswerIds = signal<string[]>([]);
  hintVisible = signal(false);
  questionStartTime = signal(0);   // wall-clock ms when question appeared
  timeRemaining = signal<number | null>(null);
  private countdownSub: Subscription | null = null;

  // ── Results accumulation ───────────────────
  answeredIPs = signal<Set<string>>(new Set());   // interaction point IDs answered
  answerResults = signal<AnswerResult[]>([]);

  // ── Computed scores ────────────────────────
  totalPointsEarned = computed(() =>
    this.answerResults().reduce((s, r) => s + r.pointsEarned, 0)
  );
  correctCount = computed(() =>
    this.answerResults().filter(r => r.correct).length
  );
  progressPct = computed(() => {
    const total = this.interactionPoints().length;
    if (!total) return 0;
    return Math.round((this.answeredIPs().size / total) * 100);
  });
  scorePct = computed(() => {
    const s = this.scenario();
    if (!s) return 0;
    return Math.min(100, Math.round((this.totalPointsEarned() / s.maxPoints) * 100));
  });

  // ── Feedback state ─────────────────────────
  lastResult = signal<{ correct: boolean; explanation?: string; pointsEarned: number } | null>(null);

  // ── Submission state ───────────────────────
  isSubmitting = signal(false);
  isCompleting = signal(false);

  private api = environment.apiUrl;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.load(id);
  }

  ngOnDestroy(): void {
    this.countdownSub?.unsubscribe();
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    const url = this.blobVideoUrl();
    if (url) URL.revokeObjectURL(url);
  }

  // ── Load all data ──────────────────────────
  load(scenarioId: string): void {
    this.lastVideoTime = 0;
    forkJoin({
      scenario: this.http.get<Scenario>(`${this.api}/scenarios/${scenarioId}`)
        .pipe(catchError(() => of(null))),
      questions: this.http.get<Question[]>(`${this.api}/scenarios/${scenarioId}/questions`)
        .pipe(catchError(() => of([]))),
      ips: this.http.get<InteractionPoint[]>(`${this.api}/scenarios/${scenarioId}/interaction-points`)
        .pipe(catchError(() => of([]))),
    }).subscribe(({ scenario, questions, ips }) => {
      if (!scenario) { this.phase.set('error'); return; }

      this.scenario.set(scenario);
      this.questions.set((questions ?? []).sort((a, b) => a.orderIndex - b.orderIndex));
      this.interactionPoints.set((ips ?? []).sort((a, b) => a.orderIndex - b.orderIndex));

      // Load video if available
      if (scenario.videoId) {
        this.http.get<Video>(`${this.api}/videos/${scenario.videoId}`)
          .pipe(catchError(() => of(null)))
          .subscribe(v => {
            this.video.set(v);
            if (v) this.loadBlobVideoUrl(v);
            this.phase.set('playing');
          });
      } else {
        this.phase.set('playing');
      }
    });
  }

  private loadBlobVideoUrl(v: Video): void {
    const token = this.authService.getToken();
    if (!token) return;

    const streamUrl = (v.videoUrl?.startsWith('http') ? v.videoUrl : `${this.api}/videos/stream/${v.id}`);

    fetch(streamUrl, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error(`Video fetch failed (${r.status})`);
        const ct = r.headers.get('content-type') ?? '';
        if (ct && !ct.startsWith('video/')) throw new Error(`Unexpected content-type: ${ct}`);
        return r.blob();
      })
      .then(blob => {
        const old = this.blobVideoUrl();
        if (old) URL.revokeObjectURL(old);
        this.blobVideoUrl.set(URL.createObjectURL(blob));
      })
      .catch(() => {
        this.blobVideoUrl.set(null);
      });
  }

  // ── Video element events ───────────────────
  onTimeUpdate(event: Event): void {
    const el = event.target as HTMLVideoElement;
    const prev = this.lastVideoTime;
    const now = el.currentTime;
    this.lastVideoTime = now;
    this.currentTime.set(now);
    this.duration.set(el.duration || 0);
    this.checkInteractionPoints(prev, now);
  }

  onPlay(): void  { this.isPlaying.set(true); }
  onPause(): void { this.isPlaying.set(false); }
  onEnded(): void {
    this.isPlaying.set(false);
    // If all IPs answered, complete the scenario
    if (this.answeredIPs().size >= this.interactionPoints().length) {
      this.completeScenario();
    }
  }

  // ── Interaction point triggering ───────────
  private checkInteractionPoints(prevTime: number, currentTime: number): void {
    if (this.phase() !== 'playing') return;

    const start = Math.min(prevTime, currentTime);
    const end = Math.max(prevTime, currentTime);

    for (const ip of this.interactionPoints()) {
      if (this.answeredIPs().has(ip.id)) continue;
      if (ip.timestampSeconds >= start && ip.timestampSeconds <= end) {
        this.triggerQuestion(ip);
        break;
      }
    }
  }

  private triggerQuestion(ip: InteractionPoint): void {
    const question = this.questions().find(q => q.id === ip.questionId);
    if (!question) return;

    this.videoElRef?.nativeElement.pause();
    this.activeIP.set(ip);
    this.activeQuestion.set(question);
    this.selectedAnswerIds.set([]);
    this.hintVisible.set(false);
    this.questionStartTime.set(Date.now());
    this.phase.set('question');

    // Start countdown if question has a time limit
    if (question.timeLimitSeconds) {
      this.timeRemaining.set(question.timeLimitSeconds);
      this.countdownSub?.unsubscribe();
      this.countdownSub = interval(1000).subscribe(() => {
        const remaining = (this.timeRemaining() ?? 0) - 1;
        if (remaining <= 0) {
          this.timeRemaining.set(0);
          this.countdownSub?.unsubscribe();
          this.autoSubmitOnTimeout();
        } else {
          this.timeRemaining.set(remaining);
        }
      });
    } else {
      this.timeRemaining.set(null);
    }
  }

  private autoSubmitOnTimeout(): void {
    if (this.selectedAnswerIds().length > 0) {
      this.submitAnswer();
    } else {
      // Submit with no selection — counts as wrong
      this.recordResult(false, 0, this.activeQuestion()?.explanation);
    }
  }

  // ── Answer selection ───────────────────────
  toggleAnswer(answerId: string): void {
    const q = this.activeQuestion();
    if (!q || this.phase() === 'feedback') return;

    if (q.type === QuestionType.SINGLE_CHOICE || q.type === QuestionType.TRUE_FALSE) {
      this.selectedAnswerIds.set([answerId]);
    } else {
      const current = this.selectedAnswerIds();
      if (current.includes(answerId)) {
        this.selectedAnswerIds.set(current.filter(id => id !== answerId));
      } else {
        this.selectedAnswerIds.set([...current, answerId]);
      }
    }
  }

  isSelected(answerId: string): boolean {
    return this.selectedAnswerIds().includes(answerId);
  }

  canSubmit = computed(() =>
    this.selectedAnswerIds().length > 0 && this.phase() === 'question'
  );

  // ── Submit to backend ──────────────────────
  submitAnswer(): void {
    const q = this.activeQuestion();
    const ip = this.activeIP();
    const s = this.scenario();
    if (!q || !s || this.isSubmitting()) return;

    this.countdownSub?.unsubscribe();
    this.isSubmitting.set(true);

    const timeTaken = Math.round((Date.now() - this.questionStartTime()) / 1000);
    const payload: SubmitAnswerRequest = {
      questionId: q.id,
      scenarioId: s.id,
      selectedAnswerIds: this.selectedAnswerIds(),
      timeTakenSeconds: timeTaken,
      hintUsed: this.hintVisible(),
    };

    this.http.post<{ correct: boolean; pointsEarned: number; explanation?: string } | null>(
      `${this.api}/progress/answers`, payload
    ).pipe(catchError(() => {
      // Fallback: evaluate locally if backend fails
      const correct = this.evaluateLocally(q, this.selectedAnswerIds());
      return of({ correct, pointsEarned: correct ? q.points : 0, explanation: q.explanation });
    })).subscribe(result => {
      this.isSubmitting.set(false);

      // Some backend implementations respond 200 with an empty body (null).
      // Treat that as a successful submission and fall back to local evaluation for UI purposes.
      const resolved = result ?? (() => {
        const correct = this.evaluateLocally(q, this.selectedAnswerIds());
        return { correct, pointsEarned: correct ? q.points : 0, explanation: q.explanation };
      })();

      this.recordResult(resolved.correct, resolved.pointsEarned, resolved.explanation);
    });
  }

  private evaluateLocally(q: Question, selected: string[]): boolean {
    const correctIds = q.answers.filter(a => a.isCorrect).map(a => a.id).sort();
    const selectedSorted = [...selected].sort();
    return JSON.stringify(correctIds) === JSON.stringify(selectedSorted);
  }

  private recordResult(correct: boolean, pointsEarned: number, explanation?: string): void {
    const q = this.activeQuestion();
    const ip = this.activeIP();
    if (!q || !ip) return;

    // Mark IP as answered
    this.answeredIPs.update(s => new Set([...s, ip.id]));

    // Record result
    this.answerResults.update(r => [...r, {
      questionId: q.id,
      selectedIds: this.selectedAnswerIds(),
      correct,
      pointsEarned,
      timeTaken: Math.round((Date.now() - this.questionStartTime()) / 1000),
    }]);

    this.lastResult.set({ correct, explanation, pointsEarned });
    this.phase.set('feedback');

    // Auto-advance after 3s
    setTimeout(() => this.dismissFeedback(), 3000);
  }

  dismissFeedback(): void {
    if (this.phase() !== 'feedback') return;
    this.lastResult.set(null);
    this.activeQuestion.set(null);
    this.activeIP.set(null);

    // Check if all IPs done
    const remaining = this.interactionPoints().filter(
      ip => !this.answeredIPs().has(ip.id)
    );

    if (remaining.length === 0) {
      this.completeScenario();
    } else {
      this.phase.set('playing');
      this.videoElRef?.nativeElement.play().catch(() => {});
    }
  }

  // ── Complete scenario ──────────────────────
  completeScenario(): void {
    const s = this.scenario();
    if (!s || this.isCompleting()) return;
    this.isCompleting.set(true);

    const score = this.scorePct();
    const pts = this.totalPointsEarned();

    this.http.post(
      `${this.api}/progress/scenarios/${s.id}/complete?score=${score}&pointsEarned=${pts}`, {}
    ).pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.isCompleting.set(false);
        this.phase.set('completed');
      });
  }

  goToResults(): void {
    const s = this.scenario();
    if (s) this.router.navigate(['/scenarios', s.id, 'results'], {
      state: {
        score: this.scorePct(),
        pointsEarned: this.totalPointsEarned(),
        correctCount: this.correctCount(),
        totalQuestions: this.interactionPoints().length,
        results: this.answerResults(),
      }
    });
  }

  // ── Video controls ─────────────────────────
  get videoEl(): HTMLVideoElement | null {
    return this.videoElRef?.nativeElement ?? null;
  }

  togglePlay(): void {
    const el = this.videoEl;
    if (!el) return;
    el.paused ? el.play().catch(() => {}) : el.pause();
  }

  toggleMute(): void {
    const el = this.videoEl;
    if (!el) return;
    el.muted = !el.muted;
    this.isMuted.set(el.muted);
  }

  seek(event: Event): void {
    const el = this.videoEl;
    if (!el) return;
    const input = event.target as HTMLInputElement;
    el.currentTime = (parseFloat(input.value) / 100) * el.duration;
  }

  exitPlayer(): void {
    const s = this.scenario();
    this.router.navigate(['/scenarios', s?.id ?? '']);
  }

  // ── Controls visibility ────────────────────
  @HostListener('mousemove')
  onMouseMove(): void {
    this.showControls.set(true);
    if (this.controlsTimer) clearTimeout(this.controlsTimer);
    if (this.phase() === 'playing' && this.isPlaying()) {
      this.controlsTimer = setTimeout(() => this.showControls.set(false), 3000);
    }
  }

  // ── Keyboard shortcuts ─────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        if (this.phase() === 'playing') this.togglePlay();
        break;
      case 'KeyM':
        this.toggleMute();
        break;
      case 'Escape':
        if (this.phase() === 'question' || this.phase() === 'feedback') break;
        this.exitPlayer();
        break;
    }
  }

  // ── Display helpers ────────────────────────
  formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  videoSrc = computed(() => {
    const v = this.video();
    if (!v) return null;
    const blobUrl = this.blobVideoUrl();
    if (blobUrl) return blobUrl;
    // Use videoUrl if it's a full URL, otherwise build the stream URL
    if (v.videoUrl?.startsWith('http')) return v.videoUrl;
    return `${this.api}/videos/stream/${v.id}`;
  });

  getIPIndex(ipId: string): number {
    return this.answerResults().findIndex(r => {
      const ip = this.interactionPoints().find(ip => ip.id === ipId);
      return ip ? r.questionId === ip.questionId : false;
    });
  }

  get progressBarWidth(): number {
    const d = this.duration();
    const t = this.currentTime();
    if (!d) return 0;
    return (t / d) * 100;
  }

  answerClass(answerId: string): string {
    const phase = this.phase();
    const q = this.activeQuestion();
    const selected = this.selectedAnswerIds().includes(answerId);

    if (phase === 'feedback') {
      const answer = q?.answers.find(a => a.id === answerId);
      if (answer?.isCorrect) return 'border-vroom-green bg-vroom-green/10 text-vroom-green';
      if (selected && !answer?.isCorrect) return 'border-red-400 bg-red-500/10 text-red-400';
      return 'border-vroom-border text-vroom-text-dim opacity-50';
    }

    if (selected) return 'border-vroom-accent bg-vroom-accent/10 text-vroom-text';
    return 'border-vroom-border hover:border-vroom-accent/40 text-vroom-text hover:bg-vroom-surface';
  }
}
