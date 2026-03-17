import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, catchError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { Scenario, ScenarioStatus, Difficulty, Theme, Assignment, AssignmentStatus, CreateAssignmentRequest } from '../../../shared/models/scenario.model';
import { Student } from '../../../shared/models/user.model';

type StatusFilter = 'ALL' | ScenarioStatus;
type SortField = 'title' | 'status' | 'difficulty' | 'completions' | 'rating' | 'updated';

@Component({
  selector: 'app-instructor-scenarios',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './instructor-scenarios.html',
})
export class InstructorScenariosComponent implements OnInit {
  readonly ScenarioStatus = ScenarioStatus;
  readonly Difficulty     = Difficulty;

  isLoading        = signal(true);
  hasError         = signal(false);
  scenarios        = signal<Scenario[]>([]);
  searchQuery      = signal('');
  statusFilter     = signal<StatusFilter>('ALL');
  sortField        = signal<SortField>('updated');
  sortDir          = signal<'asc' | 'desc'>('desc');
  actionInProgress = signal<string | null>(null);
  confirmDeleteId  = signal<string | null>(null);
  deleteError      = signal<string | null>(null);

  // ── Assign modal ──────────────────────────────────────────
  showAssignModal   = signal(false);
  assignScenario    = signal<Scenario | null>(null);
  students          = signal<Student[]>([]);
  studentSearch     = signal('');
  selectedStudentId = signal<string | null>(null);
  assignDueDate     = signal('');
  assignNote        = signal('');
  isAssigning       = signal(false);
  assignError       = signal<string | null>(null);
  assignSuccess     = signal(false);

  filteredStudents = computed(() => {
    const q = this.studentSearch().toLowerCase();
    return this.students().filter(s =>
      !q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)
    );
  });

  // ── Filtered + sorted list ────────────────────────────────
  filtered = computed(() => {
    const q    = this.searchQuery().toLowerCase();
    const sf   = this.statusFilter();
    const sort = this.sortField();
    const dir  = this.sortDir();

    let list = this.scenarios().filter(s => {
      const matchQ  = !q || s.title.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
      const matchSt = sf === 'ALL' || s.status === sf;
      return matchQ && matchSt;
    });

    list = [...list].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort) {
        case 'title':       va = a.title; vb = b.title; break;
        case 'status':      va = a.status; vb = b.status; break;
        case 'difficulty':  va = a.difficulty; vb = b.difficulty; break;
        case 'completions': va = a.completionCount; vb = b.completionCount; break;
        case 'rating':      va = a.averageRating; vb = b.averageRating; break;
        default:            va = new Date(a.updatedAt).getTime(); vb = new Date(b.updatedAt).getTime();
      }
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return dir === 'asc' ? cmp : -cmp;
    });

    return list;
  });

  counts = computed(() => {
    const sc = this.scenarios();
    return {
      all:       sc.length,
      published: sc.filter(s => s.status === ScenarioStatus.PUBLISHED).length,
      draft:     sc.filter(s => s.status === ScenarioStatus.DRAFT).length,
      archived:  sc.filter(s => s.status === ScenarioStatus.ARCHIVED).length,
    };
  });

  constructor(
    private http: HttpClient,
    private router: Router,
    public authService: AuthService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      scenarios: this.http.get<Scenario[]>(`${environment.apiUrl}/scenarios`)
        .pipe(catchError(() => of([]))),
      students: this.http.get<Student[]>(`${environment.apiUrl}/instructor/students`)
        .pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ scenarios, students }) => {
        const me = this.authService.currentUser();
        const mine = me ? (scenarios ?? []).filter(s => s.createdBy === me.id) : (scenarios ?? []);
        this.scenarios.set(mine);
        this.students.set(students ?? []);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.hasError.set(true); },
    });
  }

  setStatusFilter(value: string): void { this.statusFilter.set(value as StatusFilter); }

  setSort(field: SortField): void {
    if (this.sortField() === field) this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    else { this.sortField.set(field); this.sortDir.set(field === 'updated' ? 'desc' : 'asc'); }
  }

  togglePublish(s: Scenario, event: Event): void {
    event.stopPropagation();
    if (this.actionInProgress()) return;
    this.actionInProgress.set(s.id);
    const action = s.status === ScenarioStatus.PUBLISHED ? 'unpublish' : 'publish';
    this.http.post<Scenario>(`${environment.apiUrl}/scenarios/${s.id}/${action}`, {})
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.actionInProgress.set(null);
        if (updated) this.scenarios.update(list => list.map(x => x.id === updated.id ? updated : x));
      });
  }

  promptDelete(id: string, event: Event): void {
    event.stopPropagation();
    this.confirmDeleteId.set(id);
    this.deleteError.set(null);
  }

  cancelDelete(): void { this.confirmDeleteId.set(null); }

  confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (!id || this.actionInProgress()) return;
    this.actionInProgress.set(id);
    this.http.delete(`${environment.apiUrl}/scenarios/${id}`)
      .pipe(catchError(err => {
        this.deleteError.set(err?.error?.message ?? 'Could not delete scenario.');
        this.actionInProgress.set(null);
        return of(null);
      }))
      .subscribe(() => {
        if (!this.deleteError()) {
          this.scenarios.update(list => list.filter(s => s.id !== id));
          this.confirmDeleteId.set(null);
        }
        this.actionInProgress.set(null);
      });
  }

  goToEditor(id: string, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/instructor/scenarios', id, 'edit']);
  }

  // ── Assign modal ──────────────────────────────────────────
  openAssignModal(s: Scenario, event: Event): void {
    event.stopPropagation();
    this.assignScenario.set(s);
    this.selectedStudentId.set(null);
    this.studentSearch.set('');
    this.assignDueDate.set('');
    this.assignNote.set('');
    this.assignError.set(null);
    this.assignSuccess.set(false);
    this.showAssignModal.set(true);
  }

  closeAssignModal(): void { this.showAssignModal.set(false); }

  submitAssignment(): void {
    const scenario = this.assignScenario();
    const studentId = this.selectedStudentId();
    if (!scenario || !studentId || this.isAssigning()) return;
    this.isAssigning.set(true);
    this.assignError.set(null);

    const body: CreateAssignmentRequest = {
      studentId,
      scenarioId: scenario.id,
      dueDate: this.assignDueDate() || undefined,
      note: this.assignNote() || undefined,
    };

    this.http.post<Assignment>(`${environment.apiUrl}/instructor/assignments`, body)
      .pipe(catchError(err => {
        this.assignError.set(err?.error?.message ?? 'Failed to assign scenario.');
        this.isAssigning.set(false);
        return of(null);
      }))
      .subscribe(result => {
        this.isAssigning.set(false);
        if (result) {
          this.assignSuccess.set(true);
          setTimeout(() => this.closeAssignModal(), 1500);
        }
      });
  }

  // ── Helpers ───────────────────────────────────────────────
  statusBadge(s: ScenarioStatus): string {
    switch (s) {
      case ScenarioStatus.PUBLISHED: return 'bg-green-500/10 border-green-500/25 text-green-400';
      case ScenarioStatus.DRAFT:     return 'bg-amber-500/10 border-amber-500/25 text-amber-400';
      case ScenarioStatus.ARCHIVED:  return 'bg-vroom-surface border-vroom-border text-vroom-muted';
    }
  }

  statusDot(s: ScenarioStatus): string {
    switch (s) {
      case ScenarioStatus.PUBLISHED: return 'bg-green-400 animate-pulse';
      case ScenarioStatus.DRAFT:     return 'bg-amber-400';
      case ScenarioStatus.ARCHIVED:  return 'bg-vroom-muted';
    }
  }

  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-green-400'
      : d === Difficulty.INTERMEDIATE ? 'text-amber-400'
        : 'text-vroom-accent';
  }

  themeEmoji(t: Theme): string {
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
    return map[t] ?? '🚗';
  }

  initials(s: Student): string { return `${s.firstName?.[0] ?? ''}${s.lastName?.[0] ?? ''}`.toUpperCase(); }

  avatarColor(id: string): string {
    const colors = ['bg-vroom-accent/20 text-vroom-accent', 'bg-blue-500/20 text-blue-400', 'bg-green-500/20 text-green-400', 'bg-amber-500/20 text-amber-400', 'bg-purple-500/20 text-purple-400', 'bg-pink-500/20 text-pink-400'];
    return colors[id.charCodeAt(0) % colors.length];
  }

  relativeTime(dateStr: string): string {
    if (!dateStr) return '—';
    const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (d === 0) return 'Today'; if (d === 1) return 'Yesterday';
    if (d < 7) return `${d}d ago`; if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return `${Math.floor(d / 30)}mo ago`;
  }

  sortIcon(field: SortField): string {
    if (this.sortField() !== field) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  skeletons = Array(6).fill(0);
}
