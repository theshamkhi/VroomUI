import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of, catchError } from 'rxjs';
import { BadgesService } from '../../core/services/badges.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { StudentBadge, Badge, BadgeType, Progress, CompletionStatus } from '../../shared/models/progress.model';

type FilterTab = 'all' | BadgeType;

interface BadgeCard {
  badge: Badge;
  earned: boolean;
  earnedAt?: string;
  progressPct: number;
  progressLabel: string;
}

@Component({
  selector: 'app-my-badges',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-badges.html',
})
export class MyBadgesComponent implements OnInit {
  readonly BadgeType = BadgeType;
  protected readonly Array = Array;

  isLoading = signal(true);
  hasError = signal(false);

  allBadges = signal<Badge[]>([]);
  myBadges = signal<StudentBadge[]>([]);
  myProgress = signal<Progress[]>([]);
  activeFilter = signal<FilterTab>('all');

  earnedCount = computed(() => this.myBadges().length);
  totalCount = computed(() => this.allBadges().length);

  totalPointsEarned = computed(() =>
    this.myProgress().reduce((s, p) => s + (p.totalPointsEarned ?? 0), 0)
  );

  passedCount = computed(() =>
    this.myProgress().filter(p => p.status === CompletionStatus.COMPLETED_PASSED).length
  );

  private getStudentBadgeBadgeId(sb: StudentBadge): string | undefined {
    const anySb = sb as any;
    return (
      sb.id ??
      sb.badgeId ??
      anySb.badge_id ??
      sb.badge?.id ??
      anySb.badge?.id
    );
  }

  tabs = computed(() => {
    const earned = new Set(
      this.myBadges()
        .map(sb => this.getStudentBadgeBadgeId(sb))
        .filter((id): id is string => !!id)
    );
    const types: BadgeType[] = [
      BadgeType.COMPLETION, BadgeType.MASTERY, BadgeType.PERFECT_SCORE,
      BadgeType.STREAK, BadgeType.SPEED, BadgeType.SPECIAL,
    ];
    
    return [
      { type: 'all' as FilterTab, label: 'All', emoji: '🏆', earnedCount: this.earnedCount(), totalCount: this.totalCount() },
      ...types
        .filter(t => this.allBadges().some(b => b.type === t))
        .map(t => ({
          type: t as FilterTab,
          label: this.typeLabel(t),
          emoji: this.typeEmoji(t),
          earnedCount: this.allBadges().filter(b => b.type === t && earned.has(b.id)).length,
          totalCount:  this.allBadges().filter(b => b.type === t).length,
        })),
    ];
  });

  badgeCards = computed((): BadgeCard[] => {
    const earnedMap = new Map(
      this.myBadges()
        .map(sb => [this.getStudentBadgeBadgeId(sb), sb] as const)
        .filter((t): t is readonly [string, StudentBadge] => !!t[0])
    );
    const filter = this.activeFilter();

    return this.allBadges()
      .filter(b => filter === 'all' || b.type === filter)
      .map(b => {
        const sb = earnedMap.get(b.id);
        const { pct, label } = this.calcProgress(b);
        return {
          badge: sb ? { ...b, ...sb } : b,
          earned: !!sb,
          earnedAt: sb?.earnedAt,
          progressPct: pct,
          progressLabel: label,
        };
      })
      .sort((a, b) => {
        if (a.earned && !b.earned) return -1;
        if (!a.earned && b.earned)  return 1;
        return b.progressPct - a.progressPct;
      });
  });

  constructor(
    private badgesService: BadgesService,
    private dashboardService: DashboardService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      all: this.badgesService.getBadgesCatalog().pipe(catchError(() => of([]))),
      mine: this.badgesService.getMyBadges().pipe(catchError(() => of([]))),
      progress: this.dashboardService.getMyProgress().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ all, mine, progress }) => {
        this.allBadges.set(all ?? []);
        this.myBadges.set(mine ?? []);
        this.myProgress.set(progress ?? []);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  private calcProgress(b: Badge): { pct: number; label: string } {
    const pts = this.totalPointsEarned();
    const passed = this.passedCount();

    if (b.pointsRequired && b.scenariosRequired) {
      const ptsPct = Math.min(100, Math.round((pts / b.pointsRequired) * 100));
      const scnPct = Math.min(100, Math.round((passed / b.scenariosRequired) * 100));
      return {
        pct: Math.round((ptsPct + scnPct) / 2),
        label: `${pts}/${b.pointsRequired} pts · ${passed}/${b.scenariosRequired} scenarios`,
      };
    }
    if (b.pointsRequired) {
      const pct = Math.min(100, Math.round((pts / b.pointsRequired) * 100));
      return { pct, label: `${pts.toLocaleString()} / ${b.pointsRequired.toLocaleString()} pts` };
    }
    if (b.scenariosRequired) {
      const pct = Math.min(100, Math.round((passed / b.scenariosRequired) * 100));
      return { pct, label: `${passed} / ${b.scenariosRequired} scenarios passed` };
    }
    return { pct: 0, label: 'Keep playing to unlock' };
  }

  setFilter(t: FilterTab): void {
    this.activeFilter.set(t);
  }

  typeLabel(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION: return 'Completion';
      case BadgeType.MASTERY: return 'Mastery';
      case BadgeType.STREAK: return 'Streak';
      case BadgeType.SPEED: return 'Speed';
      case BadgeType.PERFECT_SCORE: return 'Perfect';
      case BadgeType.SPECIAL: return 'Special';
    }
    return 'Badge';
  }

  typeEmoji(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION: return '✅';
      case BadgeType.MASTERY: return '🎓';
      case BadgeType.STREAK: return '🔥';
      case BadgeType.SPEED: return '⚡';
      case BadgeType.PERFECT_SCORE: return '💯';
      case BadgeType.SPECIAL: return '⭐';
    }
    return '🏅';
  }

  typeBarColor(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION: return 'bg-vroom-green';
      case BadgeType.MASTERY: return 'bg-blue-400';
      case BadgeType.STREAK: return 'bg-vroom-amber';
      case BadgeType.SPEED: return 'bg-vroom-amber';
      case BadgeType.PERFECT_SCORE: return 'bg-vroom-accent';
      case BadgeType.SPECIAL: return 'bg-purple-400';
    }
    return 'bg-vroom-border';
  }

  relativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7) return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }
}

