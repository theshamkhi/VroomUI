import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Student } from '../../../shared/models/user.model';
import { Progress, CompletionStatus } from '../../../shared/models/progress.model';
import { Scenario, ScenarioStatus, Assignment, AssignmentStatus, CreateAssignmentRequest } from '../../../shared/models/scenario.model';

type SortField = 'name' | 'level' | 'points' | 'scenarios' | 'completion' | 'enrolled';
type ActivityFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

interface StudentWithStats extends Student {
  progressList?: Progress[];
  recentActivity?: string;
  activityStatus: ActivityFilter;
}

interface StudentComputedStats {
  totalPoints: number;
  currentLevel: number;
  averageScore: number;
  completionPercentage: number;
  completedScenarios: number;
  scenariosCompleted: number;
}

@Component({
  selector: 'app-instructor-students',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './instructor-students.html',
})
export class InstructorStudentsComponent implements OnInit {
  readonly CompletionStatus  = CompletionStatus;
  readonly AssignmentStatus  = AssignmentStatus;
  readonly ScenarioStatus    = ScenarioStatus;

  isLoading       = signal(true);
  hasError        = signal(false);
  students        = signal<StudentWithStats[]>([]);
  searchQuery     = signal('');
  activityFilter  = signal<ActivityFilter>('ALL');
  sortField       = signal<SortField>('enrolled');
  sortDir         = signal<'asc' | 'desc'>('desc');

  selectedStudent    = signal<StudentWithStats | null>(null);
  studentProgress    = signal<Progress[]>([]);
  studentAssignments = signal<Assignment[]>([]);
  isLoadingDetail    = signal(false);
  activeTab          = signal<'progress' | 'assignments'>('progress');

  editingNotes  = signal(false);
  notesValue    = signal('');
  isSavingNotes = signal(false);

  showAssignModal    = signal(false);
  assignScenarios    = signal<Scenario[]>([]);
  assignSearchQuery  = signal('');
  selectedScenarioId = signal<string | null>(null);
  assignDueDate      = signal('');
  assignNote         = signal('');
  isAssigning        = signal(false);
  assignError        = signal<string | null>(null);

  filteredAssignScenarios = computed(() => {
    const q = this.assignSearchQuery().toLowerCase();
    return this.assignScenarios().filter(s => !q || s.title.toLowerCase().includes(q));
  });

  filtered = computed(() => {
    const q    = this.searchQuery().toLowerCase();
    const af   = this.activityFilter();
    const sort = this.sortField();
    const dir  = this.sortDir();

    let list = this.students().filter(s => {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      return (!q || name.includes(q) || s.email.toLowerCase().includes(q))
        && (af === 'ALL' || s.activityStatus === af);
    });

    list = [...list].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort) {
        case 'name':       va = `${a.firstName} ${a.lastName}`; vb = `${b.firstName} ${b.lastName}`; break;
        case 'level':      va = a.currentLevel ?? 0; vb = b.currentLevel ?? 0; break;
        case 'points':     va = a.totalPoints ?? 0; vb = b.totalPoints ?? 0; break;
        case 'scenarios':  va = a.scenariosCompleted ?? a.completedScenarios ?? 0;
          vb = b.scenariosCompleted ?? b.completedScenarios ?? 0; break;
        case 'completion': va = a.completionPercentage ?? 0; vb = b.completionPercentage ?? 0; break;
        default:
          va = a.enrollmentDate ?? a.createdAt ? new Date((a.enrollmentDate ?? a.createdAt)!).getTime() : 0;
          vb = b.enrollmentDate ?? b.createdAt ? new Date((b.enrollmentDate ?? b.createdAt)!).getTime() : 0;
      }
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return dir === 'asc' ? cmp : -cmp;
    });

    return list;
  });

  counts = computed(() => {
    const s = this.students();
    return {
      all:      s.length,
      active:   s.filter(x => x.activityStatus === 'ACTIVE').length,
      inactive: s.filter(x => x.activityStatus === 'INACTIVE').length,
    };
  });

  avgCompletion = computed(() => {
    const s = this.students();
    if (!s.length) return 0;
    return Math.round(s.reduce((sum, x) => sum + (x.completionPercentage ?? 0), 0) / s.length);
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    forkJoin({
      students: this.http.get<Student[]>(`${environment.apiUrl}/instructor/students`)
        .pipe(catchError(() => of([]))),
      scenarios: this.http.get<Scenario[]>(`${environment.apiUrl}/scenarios`)
        .pipe(catchError(() => of([]))),
    }).pipe(
      switchMap(({ students, scenarios }) => {
        this.assignScenarios.set(scenarios ?? []);
        if (!students?.length) return of({ students: [], progressArrays: [] as Progress[][] });

        return forkJoin(
          (students ?? []).map(st =>
            this.http.get<Progress[]>(`${environment.apiUrl}/progress/student/${st.id}`)
              .pipe(catchError(() => of([])))
          )
        ).pipe(
          switchMap((progressArrays) => of({ students: students ?? [], progressArrays }))
        );
      })
    ).subscribe({
      next: ({ students, progressArrays }) => {
        const enriched = (students ?? []).map((s, idx) => this.enrichStudent(s, progressArrays[idx] ?? []));
        this.students.set(enriched);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.hasError.set(true);
      }
    });
  }

  private enrichStudent(s: Student, progressList: Progress[]): StudentWithStats {
    const stats = this.computeStatsFromProgress(progressList);

    const enabled = s.enabled !== false;

    const lastLogin = s.lastLoginAt ? new Date(s.lastLoginAt) : null;
    const activityStatus: ActivityFilter = enabled ? 'ACTIVE' : 'INACTIVE';

    return {
      ...s,
      ...stats,
      progressList,
      activityStatus,
      recentActivity: lastLogin ? this.relativeTime(s.lastLoginAt) : undefined,
    };
  }

  private computeStatsFromProgress(progressList: Progress[]): StudentComputedStats {
    const completed = progressList.filter(p =>
      p.status === CompletionStatus.COMPLETED_PASSED ||
      p.status === CompletionStatus.COMPLETED_FAILED
    );

    const totalPoints = progressList.reduce((sum, p) => sum + (p.totalPointsEarned ?? 0), 0);

    const scores = completed.filter(p => (p.highestScore ?? 0) > 0).map(p => p.highestScore ?? 0);
    const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const total = progressList.length || 0;
    const completionPercentage = total ? Math.round((completed.length / total) * 100) : 0;

    const completedScenarios = completed.length;
    const scenariosCompleted = completed.length;

    const currentLevel = Math.max(1, Math.floor(totalPoints / 500) + 1);

    return {
      totalPoints,
      currentLevel,
      averageScore,
      completionPercentage,
      completedScenarios,
      scenariosCompleted,
    };
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDir.set(field === 'enrolled' ? 'desc' : 'asc'); }
  }

  setActivityFilter(value: string): void { this.activityFilter.set(value as ActivityFilter); }

  openStudent(s: StudentWithStats): void {
    this.selectedStudent.set(s);
    this.notesValue.set(s.instructorNotes ?? '');
    this.editingNotes.set(false);
    this.activeTab.set('progress');
    this.loadStudentDetail(s.id);
  }

  closePanel(): void {
    this.selectedStudent.set(null);
    this.studentProgress.set([]);
    this.studentAssignments.set([]);
  }

  loadStudentDetail(studentId: string): void {
    this.isLoadingDetail.set(true);
    forkJoin({
      progress: this.http.get<Progress[]>(`${environment.apiUrl}/progress/student/${studentId}`)
        .pipe(catchError(() => of([]))),
      assignments: this.http.get<Assignment[]>(`${environment.apiUrl}/instructor/students/${studentId}/assignments`)
        .pipe(catchError(() => of([]))),
    }).subscribe(({ progress, assignments }) => {
      this.studentProgress.set(progress ?? []);
      this.studentAssignments.set(assignments ?? []);
      this.isLoadingDetail.set(false);
    });
  }

  saveNotes(): void {
    const s = this.selectedStudent(); if (!s) return;
    this.isSavingNotes.set(true);
    this.http.patch(`${environment.apiUrl}/instructor/students/${s.id}/notes`, { notes: this.notesValue() })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.isSavingNotes.set(false);
        this.editingNotes.set(false);
        const notes = this.notesValue();
        this.students.update(list => list.map(x => x.id === s.id ? { ...x, instructorNotes: notes } : x));
        this.selectedStudent.update(x => x ? { ...x, instructorNotes: notes } : x);
      });
  }

  openAssignModal(): void {
    this.selectedScenarioId.set(null);
    this.assignDueDate.set('');
    this.assignNote.set('');
    this.assignError.set(null);
    this.assignSearchQuery.set('');
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void { this.showAssignModal.set(false); }

  submitAssignment(): void {
    const student = this.selectedStudent();
    const scenarioId = this.selectedScenarioId();
    if (!student || !scenarioId || this.isAssigning()) return;
    this.isAssigning.set(true);
    this.assignError.set(null);
    const body: CreateAssignmentRequest = {
      studentId: student.id,
      scenarioId,
      dueDate: this.assignDueDate() || undefined,
      note: this.assignNote() || undefined,
    };
    this.http.post<Assignment>(`${environment.apiUrl}/instructor/assignments`, body)
      .pipe(catchError(err => {
        this.assignError.set(err?.error?.message ?? 'Failed to assign scenario.');
        this.isAssigning.set(false);
        return of(null);
      }))
      .subscribe(assignment => {
        this.isAssigning.set(false);
        if (assignment) {
          this.studentAssignments.update(a => [assignment, ...a]);
          this.activeTab.set('assignments');
          this.closeAssignModal();
        }
      });
  }

  revokeAssignment(a: Assignment, e: Event): void {
    e.stopPropagation();
    this.http.delete(`${environment.apiUrl}/instructor/assignments/${a.id}`)
      .pipe(catchError(() => of(null)))
      .subscribe(() => this.studentAssignments.update(list => list.filter(x => x.id !== a.id)));
  }

  initials(s: Student): string { return `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase(); }

  avatarColor(id: string): string {
    const colors = ['bg-vroom-accent/20 text-vroom-accent','bg-blue-500/20 text-blue-400','bg-green-500/20 text-green-400','bg-amber-500/20 text-amber-400','bg-purple-500/20 text-purple-400','bg-pink-500/20 text-pink-400'];
    return colors[id.charCodeAt(0) % colors.length];
  }

  activityBadge(s: ActivityFilter): string {
    return s === 'ACTIVE'
      ? 'bg-green-500/10 border-green-500/25 text-green-400'
      : 'bg-vroom-surface border-vroom-border text-vroom-muted';
  }

  activityDot(s: ActivityFilter): string {
    return s === 'ACTIVE' ? 'bg-green-400 animate-pulse' : 'bg-vroom-muted';
  }

  assignmentStatusBadge(s: AssignmentStatus): string {
    return s === AssignmentStatus.COMPLETED ? 'bg-green-500/10 border-green-500/25 text-green-400'
      : s === AssignmentStatus.OVERDUE   ? 'bg-red-500/10 border-red-500/25 text-red-400'
        : 'bg-amber-500/10 border-amber-500/25 text-amber-400';
  }

  assignmentStatusDot(s: AssignmentStatus): string {
    return s === AssignmentStatus.COMPLETED ? 'bg-green-400'
      : s === AssignmentStatus.OVERDUE   ? 'bg-red-400 animate-pulse'
        : 'bg-amber-400';
  }

  progressStatusColor(s: CompletionStatus): string {
    return s === CompletionStatus.COMPLETED_PASSED ? 'text-green-400'
      : s === CompletionStatus.COMPLETED_FAILED ? 'text-red-400'
        : s === CompletionStatus.IN_PROGRESS      ? 'text-amber-400' : 'text-vroom-muted';
  }

  progressStatusLabel(s: CompletionStatus): string {
    return s === CompletionStatus.COMPLETED_PASSED ? 'Passed'
      : s === CompletionStatus.COMPLETED_FAILED ? 'Failed'
        : s === CompletionStatus.IN_PROGRESS      ? 'In Progress' : 'Not Started';
  }

  levelLabel(level: number): string {
    if (level <= 1) return 'Novice'; if (level <= 3) return 'Learner';
    if (level <= 5) return 'Competent'; if (level <= 8) return 'Proficient'; return 'Expert';
  }

  relativeTime(d?: string | null): string {
    if (!d) return '—';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return 'Today'; if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`; if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  sortIcon(f: SortField): string {
    if (this.sortField() !== f) return '↕'; return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  scenarioCount(s: StudentWithStats): number { return s.scenariosCompleted ?? s.completedScenarios ?? 0; }

  skeletons = Array(5).fill(0);
}
