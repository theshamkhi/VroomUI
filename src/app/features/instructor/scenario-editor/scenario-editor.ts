import { Component, signal, computed, OnInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import {
  Scenario, ScenarioStatus, Difficulty, Theme,
  QuestionType, Question, Answer, InteractionPoint
} from '../../../shared/models/scenario.model';
import { Video, VideoStatus } from '../../../shared/models/api.model';

type EditorStep = 'meta' | 'video' | 'questions' | 'timeline' | 'review';

interface DraftAnswer {
  answerText: string;
  isCorrect: boolean;
  explanation: string;
}

interface DraftQuestion {
  id?: string;
  type: QuestionType;
  questionText: string;
  hint: string;
  explanation: string;
  points: number;
  timeLimitSeconds: number;
  answers: DraftAnswer[];
  pinnedAt?: number;
  interactionPointId?: string;
}

@Component({
  selector: 'app-scenario-editor',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './scenario-editor.html',
})
export class ScenarioEditorComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl') videoElRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('timelineEl') timelineElRef?: ElementRef<HTMLDivElement>;

  readonly Difficulty   = Difficulty;
  readonly Theme        = Theme;
  readonly QuestionType = QuestionType;
  readonly VideoStatus  = VideoStatus;
  readonly themes       = Object.values(Theme);
  readonly difficulties = Object.values(Difficulty);

  editId = signal<string | null>(null);
  isEdit = computed(() => !!this.editId());

  currentStep   = signal<EditorStep>('meta');
  stepsComplete = signal<Set<EditorStep>>(new Set());

  steps: { key: EditorStep; label: string; icon: string }[] = [
    { key: 'meta',      label: 'Details',   icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    { key: 'video',     label: 'Video',     icon: 'M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
    { key: 'questions', label: 'Questions', icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'timeline',  label: 'Timeline',  icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { key: 'review',    label: 'Publish',   icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  ];

  stepIndex(key: EditorStep): number { return this.steps.findIndex(s => s.key === key); }
  isStepReachable(key: EditorStep): boolean {
    const target  = this.stepIndex(key);
    const current = this.stepIndex(this.currentStep());
    return target <= current || this.stepsComplete().has(this.steps[target - 1]?.key as EditorStep);
  }

  isLoading   = signal(false);
  isSaving    = signal(false);
  saveError   = signal<string | null>(null);
  saveSuccess = signal(false);

  metaForm!: FormGroup;

  scenarioId    = signal<string | null>(null);
  myVideos      = signal<Video[]>([]);
  selectedVideo = signal<Video | null>(null);
  blobVideoUrl  = signal<string | null>(null);
  uploadFile    = signal<File | null>(null);
  uploadTitle   = signal('');
  uploadProgress= signal(0);
  isUploading   = signal(false);
  videoTab      = signal<'select' | 'upload'>('select');

  questions        = signal<DraftQuestion[]>([]);
  editingQuestion  = signal<DraftQuestion | null>(null);
  editingQIndex    = signal<number | null>(null);
  showQForm        = signal(false);
  questionForm!: FormGroup;
  isSavingQuestion = signal(false);
  questionError    = signal<string | null>(null);

  videoDuration   = signal(0);
  currentTime     = signal(0);
  isPlaying       = signal(false);
  pendingPin      = signal<number | null>(null);
  isSavingPin     = signal(false);
  timelineError   = signal<string | null>(null);
  pinnedQuestions   = computed(() => this.questions().filter(q => q.pinnedAt !== undefined));
  unpinnedQuestions = computed(() => this.questions().filter(q => q.pinnedAt === undefined));

  isPublishing  = signal(false);
  publishError  = signal<string | null>(null);
  scenario      = signal<Scenario | null>(null);

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    public authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.buildMetaForm();
    this.buildQuestionForm();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) { this.editId.set(id); this.scenarioId.set(id); this.loadExisting(id); }
    this.loadMyVideos();
  }

  ngOnDestroy(): void { const url = this.blobVideoUrl(); if (url) URL.revokeObjectURL(url); }

  buildMetaForm(): void {
    this.metaForm = this.fb.group({
      title:              ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
      description:        ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1000)]],
      difficulty:         [Difficulty.BEGINNER, Validators.required],
      theme:              [Theme.URBAN_DRIVING, Validators.required],
      passingScore:       [70,  [Validators.required, Validators.min(1), Validators.max(100)]],
      maxPoints:          [100, [Validators.required, Validators.min(10)]],
      tags:               [''],
      learningObjectives: [''],
    });
  }

  buildQuestionForm(q?: DraftQuestion): void {
    const answers = q?.answers ?? [
      { answerText: '', isCorrect: true,  explanation: '' },
      { answerText: '', isCorrect: false, explanation: '' },
      { answerText: '', isCorrect: false, explanation: '' },
      { answerText: '', isCorrect: false, explanation: '' },
    ];
    this.questionForm = this.fb.group({
      type:             [q?.type ?? QuestionType.SINGLE_CHOICE, Validators.required],
      questionText:     [q?.questionText ?? '', [Validators.required, Validators.minLength(10)]],
      hint:             [q?.hint ?? ''],
      explanation:      [q?.explanation ?? ''],
      points:           [q?.points ?? 10,  [Validators.required, Validators.min(1)]],
      timeLimitSeconds: [q?.timeLimitSeconds ?? 30, [Validators.required, Validators.min(5)]],
      answers: this.fb.array(answers.map(a => this.fb.group({
        answerText:  [a.answerText, Validators.required],
        isCorrect:   [a.isCorrect],
        explanation: [a.explanation],
      }))),
    });
    this.questionForm.get('type')?.valueChanges.subscribe(type => {
      if (type === QuestionType.TRUE_FALSE) {
        const arr = this.questionForm.get('answers') as FormArray;
        while (arr.length > 2) arr.removeAt(arr.length - 1);
        arr.at(0).patchValue({ answerText: 'True',  isCorrect: true  });
        arr.at(1).patchValue({ answerText: 'False', isCorrect: false });
      }
    });
  }

  get answersArray(): FormArray { return this.questionForm.get('answers') as FormArray; }

  addAnswer(): void {
    if (this.answersArray.length >= 6) return;
    this.answersArray.push(this.fb.group({ answerText: ['', Validators.required], isCorrect: [false], explanation: [''] }));
  }

  removeAnswer(i: number): void {
    if (this.answersArray.length <= 2) return;
    this.answersArray.removeAt(i);
  }

  setSingleCorrect(i: number): void {
    if (this.questionForm.get('type')?.value !== QuestionType.MULTIPLE_CHOICE) {
      this.answersArray.controls.forEach((c, idx) => c.patchValue({ isCorrect: idx === i }));
    }
  }

  loadExisting(id: string): void {
    this.isLoading.set(true);
    this.http.get<Scenario>(`${environment.apiUrl}/scenarios/${id}`)
      .pipe(catchError(() => of(null)))
      .subscribe(sc => {
        if (sc) {
          this.scenario.set(sc);
          this.metaForm.patchValue({
            title: sc.title, description: sc.description,
            difficulty: sc.difficulty, theme: sc.theme,
            passingScore: sc.passingScore, maxPoints: sc.maxPoints,
            tags: sc.tags?.join(', ') ?? '',
            learningObjectives: sc.learningObjectives?.join('\n') ?? '',
          });
          if (sc.videoId) this.loadVideo(sc.videoId);
          this.loadQuestions(id);
          const done = new Set(this.stepsComplete()); done.add('meta'); this.stepsComplete.set(done);
        }
        this.isLoading.set(false);
      });
  }

  loadVideo(videoId: string): void {
    this.http.get<Video>(`${environment.apiUrl}/videos/${videoId}`)
      .pipe(catchError(() => of(null)))
      .subscribe(v => {
        if (v) {
          this.selectedVideo.set(v);
          this.loadBlobVideoUrl(v);
          const done = new Set(this.stepsComplete()); done.add('video'); this.stepsComplete.set(done);
        }
      });
  }

  loadBlobVideoUrl(v: Video): void {
    const token = localStorage.getItem('vroom_token');
    if (!token) return;

    const streamUrl = (v.videoUrl?.startsWith('http') ? v.videoUrl : `${environment.apiUrl}/videos/stream/${v.id}`);

    // Fetch video with auth header and create blob URL for <video> element.
    // Important: validate status + content-type to avoid creating a blob from a JSON/HTML error page.
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
        // If the server allows unauthenticated streaming, this may work.
        this.blobVideoUrl.set(streamUrl ?? null);
      });
  }

  loadQuestions(scenarioId: string): void {
    this.http.get<Question[]>(`${environment.apiUrl}/scenarios/${scenarioId}/questions`)
      .pipe(catchError(() => of([])))
      .subscribe(qs => {
        this.http.get<InteractionPoint[]>(`${environment.apiUrl}/scenarios/${scenarioId}/interaction-points`)
          .pipe(catchError(() => of([])))
          .subscribe(ips => {
            const mapped: DraftQuestion[] = (qs ?? []).map(q => {
              const pin = ips?.find(ip => ip.questionId === q.id);
              return { id: q.id, type: q.type, questionText: q.questionText, hint: q.hint ?? '', explanation: q.explanation ?? '',
                points: q.points, timeLimitSeconds: q.timeLimitSeconds ?? 30,
                answers: q.answers.map(a => ({ answerText: a.answerText, isCorrect: a.isCorrect, explanation: a.explanation ?? '' })),
                pinnedAt: pin?.timestampSeconds, interactionPointId: pin?.id };
            });
            this.questions.set(mapped);
            const done = new Set(this.stepsComplete());
            if (mapped.length > 0) done.add('questions');
            if (mapped.some(q => q.pinnedAt !== undefined)) done.add('timeline');
            this.stepsComplete.set(done);
          });
      });
  }

  loadMyVideos(): void {
    this.http.get<Video[]>(`${environment.apiUrl}/videos/my-videos`)
      .pipe(catchError(() => of([])))
      .subscribe(v => this.myVideos.set(v ?? []));
  }

  goTo(step: EditorStep): void { if (this.isStepReachable(step)) this.currentStep.set(step); }

  saveMetadata(): void {
    if (this.metaForm.invalid) { this.metaForm.markAllAsTouched(); return; }
    this.isSaving.set(true); this.saveError.set(null);
    const v = this.metaForm.value;
    const body = {
      title: v.title as string,
      description: v.description as string,
      difficulty: v.difficulty as Difficulty,
      theme: v.theme as Theme,
      passingScore: v.passingScore as number,
      maxPoints: v.maxPoints as number,
      tags: v.tags ? v.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      learningObjectives: v.learningObjectives ? v.learningObjectives.split('\n').map((l: string) => l.trim()).filter(Boolean) : [],
    };
    const req = this.scenarioId()
      ? this.http.put<Scenario>(`${environment.apiUrl}/scenarios/${this.scenarioId()}`, body)
      : this.http.post<Scenario>(`${environment.apiUrl}/scenarios`, body);
    req.pipe(catchError(err => { this.saveError.set(err?.error?.message ?? 'Failed to save.'); return of(null); }))
      .subscribe(sc => {
        this.isSaving.set(false);
        if (sc) {
          this.scenarioId.set(sc.id); this.scenario.set(sc);
          const done = new Set(this.stepsComplete()); done.add('meta'); this.stepsComplete.set(done);
          this.currentStep.set('video');
        }
      });
  }

  onVideoFileChange(event: Event): void {
    const f = (event.target as HTMLInputElement).files?.[0];
    if (!f) return;
    this.uploadFile.set(f);
    if (!this.uploadTitle()) this.uploadTitle.set(f.name.replace(/\.[^.]+$/, ''));
  }

  selectVideo(v: Video): void { this.selectedVideo.set(v); }

  private buildScenarioBody(extra: Record<string, unknown> = {}): Record<string, unknown> {
    const v = this.metaForm.value;
    const selected = this.selectedVideo();
    const durationSeconds =
      typeof selected?.durationSeconds === 'number'
        ? selected.durationSeconds
        : (this.videoDuration() ? Math.round(this.videoDuration()) : undefined);

    const estimatedMinutes =
      typeof durationSeconds === 'number'
        ? Math.max(0, Math.ceil(durationSeconds / 60))
        : undefined;

    return {
      title: v.title,
      description: v.description,
      difficulty: v.difficulty as Difficulty,
      theme: v.theme as Theme,
      passingScore: v.passingScore,
      maxPoints: v.maxPoints,
      tags: v.tags ? v.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      learningObjectives: v.learningObjectives
        ? v.learningObjectives.split('\n').map((l: string) => l.trim()).filter(Boolean)
        : [],
      ...(typeof durationSeconds === 'number' ? { durationSeconds } : {}),
      ...(typeof estimatedMinutes === 'number' ? { estimatedMinutes } : {}),
      ...extra,
    };
  }

  attachVideo(): void {
    const vid = this.selectedVideo(); const sid = this.scenarioId();
    if (!vid || !sid) return;
    this.isSaving.set(true); this.saveError.set(null);
    this.http.put(`${environment.apiUrl}/scenarios/${sid}`, this.buildScenarioBody({ videoId: vid.id }))
      .pipe(catchError(err => { this.saveError.set(err?.error?.message ?? 'Failed to attach video.'); return of(null); }))
      .subscribe(sc => {
        this.isSaving.set(false);
        if (sc !== null) {
          this.loadBlobVideoUrl(vid);
          const done = new Set(this.stepsComplete()); done.add('video'); this.stepsComplete.set(done); this.currentStep.set('questions');
        }
      });
  }

  uploadAndAttach(): void {
    const file = this.uploadFile(); const sid = this.scenarioId();
    if (!file || !sid) return;
    this.isUploading.set(true); this.uploadProgress.set(0); this.saveError.set(null);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', this.uploadTitle() || file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${environment.apiUrl}/videos/upload`);
    const token = localStorage.getItem('vroom_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) this.uploadProgress.set(Math.round(e.loaded / e.total * 100)); });
    xhr.addEventListener('load', () => {
      this.isUploading.set(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const video: Video = JSON.parse(xhr.responseText);
        this.selectedVideo.set(video); this.myVideos.update(v => [...v, video]);
        this.http.put(`${environment.apiUrl}/scenarios/${sid}`, this.buildScenarioBody({ videoId: video.id }))
          .pipe(catchError(() => of(null)))
          .subscribe(() => {
            this.loadBlobVideoUrl(video);
            const done = new Set(this.stepsComplete()); done.add('video'); this.stepsComplete.set(done); this.currentStep.set('questions');
          });
      } else { this.saveError.set('Upload failed. Please try again.'); }
    });
    xhr.addEventListener('error', () => { this.isUploading.set(false); this.saveError.set('Upload failed.'); });
    xhr.send(formData);
  }

  skipVideo(): void { const done = new Set(this.stepsComplete()); done.add('video'); this.stepsComplete.set(done); this.currentStep.set('questions'); }

  openNewQuestion(): void { this.editingQIndex.set(null); this.editingQuestion.set(null); this.buildQuestionForm(); this.showQForm.set(true); this.questionError.set(null); }
  editQuestion(q: DraftQuestion, i: number): void { this.editingQIndex.set(i); this.editingQuestion.set(q); this.buildQuestionForm(q); this.showQForm.set(true); this.questionError.set(null); }
  cancelQuestion(): void { this.showQForm.set(false); this.editingQIndex.set(null); this.editingQuestion.set(null); }

  saveQuestion(): void {
    if (this.questionForm.invalid) { this.questionForm.markAllAsTouched(); return; }
    const sid = this.scenarioId(); if (!sid) return;
    const v = this.questionForm.value;
    const body = { type: v.type, questionText: v.questionText, hint: v.hint || undefined, explanation: v.explanation || undefined,
      points: v.points, timeLimitSeconds: v.timeLimitSeconds, orderIndex: this.editingQIndex() ?? this.questions().length,
      answers: v.answers.map((a: DraftAnswer, i: number) => ({ answerText: a.answerText, isCorrect: a.isCorrect, orderIndex: i, explanation: a.explanation || undefined })) };
    this.isSavingQuestion.set(true); this.questionError.set(null);
    const existingId = this.editingQuestion()?.id;
    const req = existingId
      ? this.http.put<Question>(`${environment.apiUrl}/scenarios/${sid}/questions/${existingId}`, body)
      : this.http.post<Question>(`${environment.apiUrl}/scenarios/${sid}/questions`, body);
    req.pipe(catchError(err => { this.questionError.set(err?.error?.message ?? 'Failed to save question.'); return of(null); }))
      .subscribe(saved => {
        this.isSavingQuestion.set(false);
        if (saved) {
          const draft: DraftQuestion = { id: saved.id, type: saved.type, questionText: saved.questionText, hint: saved.hint ?? '',
            explanation: saved.explanation ?? '', points: saved.points, timeLimitSeconds: saved.timeLimitSeconds ?? 30,
            answers: saved.answers.map(a => ({ answerText: a.answerText, isCorrect: a.isCorrect, explanation: a.explanation ?? '' })),
            pinnedAt: this.editingQuestion()?.pinnedAt, interactionPointId: this.editingQuestion()?.interactionPointId };
          const qs = [...this.questions()]; const idx = this.editingQIndex();
          if (idx !== null) qs[idx] = draft; else qs.push(draft);
          this.questions.set(qs);
          const done = new Set(this.stepsComplete()); done.add('questions'); this.stepsComplete.set(done);
          this.showQForm.set(false); this.editingQIndex.set(null); this.editingQuestion.set(null);
        }
      });
  }

  deleteQuestion(q: DraftQuestion, i: number): void {
    const sid = this.scenarioId();
    if (!sid || !q.id) { const qs = [...this.questions()]; qs.splice(i, 1); this.questions.set(qs); return; }
    this.http.delete(`${environment.apiUrl}/scenarios/${sid}/questions/${q.id}`)
      .pipe(catchError(() => of(null)))
      .subscribe(() => { const qs = [...this.questions()]; qs.splice(i, 1); this.questions.set(qs); });
  }

  proceedToTimeline(): void { const done = new Set(this.stepsComplete()); done.add('questions'); this.stepsComplete.set(done); this.currentStep.set('timeline'); }

  onVideoLoaded(): void { const el = this.videoElRef?.nativeElement; if (el) this.videoDuration.set(el.duration || 0); }
  onTimeUpdate(): void { const el = this.videoElRef?.nativeElement; if (el) this.currentTime.set(el.currentTime); }
  onVideoEnded(): void { this.isPlaying.set(false); }

  seekTo(t: number): void { const el = this.videoElRef?.nativeElement; if (el) { el.currentTime = t; this.currentTime.set(t); } }

  seekFromTimeline(event: MouseEvent): void {
    const bar = this.timelineElRef?.nativeElement; if (!bar || !this.videoDuration()) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    this.seekTo(ratio * this.videoDuration());
  }

  togglePlay(): void {
    const el = this.videoElRef?.nativeElement; if (!el) return;
    if (el.paused) { el.play(); this.isPlaying.set(true); } else { el.pause(); this.isPlaying.set(false); }
  }

  dropPin(): void { this.pendingPin.set(this.currentTime()); }
  cancelPin(): void { this.pendingPin.set(null); }

  assignPin(q: DraftQuestion, qIdx: number): void {
    const t = this.pendingPin(); const sid = this.scenarioId();
    if (t === null || !sid || !q.id) return;
    this.isSavingPin.set(true); this.timelineError.set(null);
    const body = { questionId: q.id, timestampSeconds: t, orderIndex: qIdx };
    const req = q.interactionPointId
      ? this.http.put<InteractionPoint>(`${environment.apiUrl}/scenarios/${sid}/interaction-points/${q.interactionPointId}`, body)
      : this.http.post<InteractionPoint>(`${environment.apiUrl}/scenarios/${sid}/interaction-points`, body);
    req.pipe(catchError(err => { this.timelineError.set(err?.error?.message ?? 'Failed to save pin.'); return of(null); }))
      .subscribe(ip => {
        this.isSavingPin.set(false);
        if (ip) {
          const qs = [...this.questions()]; qs[qIdx] = { ...qs[qIdx], pinnedAt: t, interactionPointId: ip.id };
          this.questions.set(qs); this.pendingPin.set(null);
          const done = new Set(this.stepsComplete()); done.add('timeline'); this.stepsComplete.set(done);
        }
      });
  }

  removePin(q: DraftQuestion, qIdx: number): void {
    const sid = this.scenarioId();
    if (!sid || !q.interactionPointId) { const qs = [...this.questions()]; qs[qIdx] = { ...qs[qIdx], pinnedAt: undefined, interactionPointId: undefined }; this.questions.set(qs); return; }
    this.http.delete(`${environment.apiUrl}/scenarios/${sid}/interaction-points/${q.interactionPointId}`)
      .pipe(catchError(() => of(null)))
      .subscribe(() => { const qs = [...this.questions()]; qs[qIdx] = { ...qs[qIdx], pinnedAt: undefined, interactionPointId: undefined }; this.questions.set(qs); });
  }

  proceedToReview(): void { const done = new Set(this.stepsComplete()); done.add('timeline'); this.stepsComplete.set(done); this.currentStep.set('review'); }

  publishScenario(): void {
    const sid = this.scenarioId(); if (!sid) return;
    this.isPublishing.set(true); this.publishError.set(null);
    this.http.post<Scenario>(`${environment.apiUrl}/scenarios/${sid}/publish`, {})
      .pipe(catchError(err => { this.publishError.set(err?.error?.message ?? 'Failed to publish.'); return of(null); }))
      .subscribe(sc => {
        this.isPublishing.set(false);
        if (sc) { this.scenario.set(sc); this.saveSuccess.set(true); setTimeout(() => this.router.navigate(['/dashboard/instructor']), 2000); }
      });
  }

  saveDraftAndExit(): void { this.router.navigate(['/dashboard/instructor']); }

  formatTime(s: number): string {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  }

  pinLeftPct(t: number): number { const dur = this.videoDuration(); return dur ? (t / dur) * 100 : 0; }
  typeLabel(t: QuestionType): string { return t === QuestionType.SINGLE_CHOICE ? 'Single' : t === QuestionType.MULTIPLE_CHOICE ? 'Multi' : 'T/F'; }
  themeLabel(t: Theme): string { return t.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
  diffColor(d: Difficulty): string { return d === Difficulty.BEGINNER ? 'text-green-400' : d === Difficulty.INTERMEDIATE ? 'text-amber-400' : 'text-red-400'; }
  totalPoints = computed(() => this.questions().reduce((s, q) => s + q.points, 0));
  fc(name: string) { return this.metaForm.get(name); }
  hasError(form: 'meta' | 'q', name: string, err: string): boolean {
    const ctrl = form === 'meta' ? this.metaForm.get(name) : this.questionForm.get(name);
    return !!(ctrl?.invalid && ctrl?.touched && ctrl?.hasError(err));
  }
  skeletons = Array(3).fill(0);
}
