import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of, catchError, forkJoin } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { ScenarioService } from '../../core/services/scenario.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { Scenario, Difficulty, Theme } from '../../shared/models/scenario.model';
import { Progress, CompletionStatus } from '../../shared/models/progress.model';

type SortOption = 'popular' | 'top-rated' | 'newest' | 'duration-asc' | 'duration-desc';
type ViewMode = 'grid' | 'list';

interface ThemeOption {
  value: Theme;
  label: string;
  emoji: string;
}

@Component({
  selector: 'app-scenarios',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './scenarios.html'
})
export class ScenariosComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // State
  isLoading = signal(true);
  isSearching = signal(false);
  hasError = signal(false);

  // Data
  allScenarios = signal<Scenario[]>([]);
  myProgress = signal<Progress[]>([]);

  // Filters
  searchQuery = signal('');
  selectedDifficulty = signal<Difficulty | null>(null);
  selectedTheme = signal<Theme | null>(null);
  selectedSort = signal<SortOption>('popular');
  viewMode = signal<ViewMode>('grid');

  // UI state
  showThemeDropdown = signal(false);

  readonly Difficulty = Difficulty;
  readonly Theme = Theme;
  readonly CompletionStatus = CompletionStatus;

  difficulties: { value: Difficulty; label: string; color: string; bg: string }[] = [
    { value: Difficulty.BEGINNER, label: 'Beginner', color: 'text-vroom-green', bg: 'bg-vroom-green/10 border-vroom-green/30' },
    { value: Difficulty.INTERMEDIATE, label: 'Intermediate', color: 'text-vroom-amber', bg: 'bg-vroom-amber/10 border-amber-500/30' },
    { value: Difficulty.ADVANCED, label: 'Advanced', color: 'text-vroom-accent', bg: 'bg-vroom-accent/10 border-vroom-accent/30' },
  ];

  themes: ThemeOption[] = [
    { value: Theme.URBAN_DRIVING,       label: 'Urban Driving',       emoji: '🏙️' },
    { value: Theme.HIGHWAY_DRIVING,     label: 'Highway',             emoji: '🛣️' },
    { value: Theme.PARKING,             label: 'Parking',             emoji: '🅿️' },
    { value: Theme.NIGHT_DRIVING,       label: 'Night Driving',       emoji: '🌙' },
    { value: Theme.WEATHER_CONDITIONS,  label: 'Weather',             emoji: '🌧️' },
    { value: Theme.DEFENSIVE_DRIVING,   label: 'Defensive Driving',   emoji: '🛡️' },
    { value: Theme.EMERGENCY_SITUATIONS,label: 'Emergency',           emoji: '🚨' },
    { value: Theme.INTERSECTIONS,       label: 'Intersections',       emoji: '✚' },
    { value: Theme.PEDESTRIAN_SAFETY,   label: 'Pedestrian Safety',   emoji: '🚶' },
    { value: Theme.ROAD_SIGNS,          label: 'Road Signs',          emoji: '🪧' },
    { value: Theme.TRAFFIC_LAWS,        label: 'Traffic Laws',        emoji: '⚖️' },
    { value: Theme.VEHICLE_MAINTENANCE, label: 'Maintenance',         emoji: '🔧' },
    { value: Theme.ECO_DRIVING,         label: 'Eco Driving',         emoji: '🌿' },
    { value: Theme.MOUNTAIN_DRIVING,    label: 'Mountain',            emoji: '⛰️' },
    { value: Theme.RURAL_DRIVING,       label: 'Rural',               emoji: '🌾' },
    { value: Theme.ROUNDABOUTS,         label: 'Roundabouts',         emoji: '🔄' },
  ];

  sortOptions: { value: SortOption; label: string }[] = [
    { value: 'popular',       label: 'Most Popular' },
    { value: 'top-rated',     label: 'Top Rated' },
    { value: 'newest',        label: 'Newest First' },
    { value: 'duration-asc',  label: 'Shortest First' },
    { value: 'duration-desc', label: 'Longest First' },
  ];

  // Computed filtered + sorted list
  filteredScenarios = computed(() => {
    let list = [...this.allScenarios()];
    const q = this.searchQuery().toLowerCase().trim();
    const diff = this.selectedDifficulty();
    const theme = this.selectedTheme();
    const sort = this.selectedSort();

    if (q) {
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (diff) list = list.filter(s => s.difficulty === diff);
    if (theme) list = list.filter(s => s.theme === theme);

    switch (sort) {
      case 'popular':       list.sort((a, b) => (b.completionCount ?? 0) - (a.completionCount ?? 0)); break;
      case 'top-rated':     list.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0)); break;
      case 'newest':        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'duration-asc':  list.sort((a, b) => a.durationSeconds - b.durationSeconds); break;
      case 'duration-desc': list.sort((a, b) => b.durationSeconds - a.durationSeconds); break;
    }

    return list;
  });

  activeFilterCount = computed(() =>
    (this.selectedDifficulty() ? 1 : 0) +
    (this.selectedTheme() ? 1 : 0) +
    (this.searchQuery().trim() ? 1 : 0)
  );

  stats = computed(() => {
    const all = this.allScenarios();
    const prog = this.myProgress();
    const completed = prog.filter(p =>
      p.status === CompletionStatus.COMPLETED_PASSED ||
      p.status === CompletionStatus.COMPLETED_FAILED
    ).length;
    return {
      total: all.length,
      completed,
      remaining: all.length - completed,
    };
  });

  ngOnInit(): void {
    // Debounced search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(q => {
      this.searchQuery.set(q);
    });

    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      scenarios: this.scenarioService.getAll().pipe(catchError(() => of([]))),
      progress: this.dashboardService.getMyProgress().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ scenarios, progress }) => {
        this.allScenarios.set(scenarios);
        this.myProgress.set(progress);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.hasError.set(true);
      }
    });
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  setDifficulty(d: Difficulty | null): void {
    this.selectedDifficulty.set(this.selectedDifficulty() === d ? null : d);
  }

  setTheme(t: Theme | null): void {
    this.selectedTheme.set(t);
    this.showThemeDropdown.set(false);
  }

  setSort(s: SortOption): void {
    this.selectedSort.set(s);
  }

  setView(v: ViewMode): void {
    this.viewMode.set(v);
  }

  clearAllFilters(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
    this.selectedDifficulty.set(null);
    this.selectedTheme.set(null);
    this.selectedSort.set('popular');
  }

  toggleThemeDropdown(): void {
    this.showThemeDropdown.update(v => !v);
  }

  // Progress helpers
  progressFor(scenarioId: string): Progress | undefined {
    return this.myProgress().find(p => p.scenarioId === scenarioId);
  }

  statusLabel(p: Progress | undefined): string {
    if (!p) return '';
    switch (p.status) {
      case CompletionStatus.COMPLETED_PASSED: return '✓ Passed';
      case CompletionStatus.COMPLETED_FAILED: return '✗ Failed';
      case CompletionStatus.IN_PROGRESS:      return '▶ In Progress';
      default: return '';
    }
  }

  statusColor(p: Progress | undefined): string {
    if (!p) return '';
    switch (p.status) {
      case CompletionStatus.COMPLETED_PASSED: return 'text-vroom-green';
      case CompletionStatus.COMPLETED_FAILED: return 'text-red-400';
      case CompletionStatus.IN_PROGRESS:      return 'text-vroom-amber';
      default: return '';
    }
  }

  statusBadgeBg(p: Progress | undefined): string {
    if (!p) return '';
    switch (p.status) {
      case CompletionStatus.COMPLETED_PASSED: return 'bg-vroom-green/15 border-vroom-green/30 text-vroom-green';
      case CompletionStatus.COMPLETED_FAILED: return 'bg-red-500/15 border-red-500/30 text-red-400';
      case CompletionStatus.IN_PROGRESS:      return 'bg-vroom-amber/15 border-amber-500/30 text-vroom-amber';
      default: return '';
    }
  }

  difficultyColor(d: Difficulty): string {
    return d === Difficulty.BEGINNER ? 'text-vroom-green' :
      d === Difficulty.INTERMEDIATE ? 'text-vroom-amber' : 'text-vroom-accent';
  }

  difficultyBg(d: Difficulty): string {
    return d === Difficulty.BEGINNER
      ? 'bg-vroom-green/10 border-vroom-green/20 text-vroom-green'
      : d === Difficulty.INTERMEDIATE
        ? 'bg-vroom-amber/10 border-amber-500/20 text-vroom-amber'
        : 'bg-vroom-accent/10 border-vroom-accent/20 text-vroom-accent';
  }

  themeEmoji(theme: Theme): string {
    return this.themes.find(t => t.value === theme)?.emoji ?? '🚗';
  }

  themeLabel(theme: Theme): string {
    return this.themes.find(t => t.value === theme)?.label ?? theme;
  }

  themeGradient(theme: Theme): string {
    const map: Partial<Record<Theme, string>> = {
      [Theme.URBAN_DRIVING]:        '#1a1a2e, #16213e',
      [Theme.HIGHWAY_DRIVING]:      '#0d1b2a, #1b2838',
      [Theme.PARKING]:              '#1a1a1a, #2d2d2d',
      [Theme.NIGHT_DRIVING]:        '#0a0a1a, #1a1a3e',
      [Theme.WEATHER_CONDITIONS]:   '#0d1b2a, #1a2a3a',
      [Theme.DEFENSIVE_DRIVING]:    '#1a1a1a, #2a1a1a',
      [Theme.EMERGENCY_SITUATIONS]: '#2a0a0a, #1a0a0a',
      [Theme.INTERSECTIONS]:        '#1a1a2e, #2e1a2e',
      [Theme.PEDESTRIAN_SAFETY]:    '#0a1a0a, #1a2e1a',
      [Theme.ROAD_SIGNS]:           '#1a1a0a, #2e2e0a',
      [Theme.TRAFFIC_LAWS]:         '#1a0a1a, #2e1a2e',
      [Theme.VEHICLE_MAINTENANCE]:  '#1a1a1a, #2a2a1a',
      [Theme.ECO_DRIVING]:          '#0a1a0a, #1a2a0a',
      [Theme.MOUNTAIN_DRIVING]:     '#0a1a1a, #1a2a2a',
      [Theme.RURAL_DRIVING]:        '#0a1a0a, #1a2a1a',
      [Theme.ROUNDABOUTS]:          '#1a0a1a, #2a1a2a',
    };
    return map[theme] ?? '#16161E, #1A1A28';
  }

  selectedThemeOption = computed(() =>
    this.themes.find(t => t.value === this.selectedTheme()) ?? null
  );

  formatDuration(seconds: number): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  formatRating(r: number): string {
    return r ? r.toFixed(1) : '—';
  }

  scoreColor(score: number): string {
    if (score >= 80) return 'text-vroom-green';
    if (score >= 60) return 'text-vroom-amber';
    return 'text-red-400';
  }

  // Skeleton array for loading state
  skeletons = Array(12).fill(0);

  constructor(
    private scenarioService: ScenarioService,
    private dashboardService: DashboardService,
  ) {}
}
