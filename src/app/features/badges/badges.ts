import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Badge,
  BadgeType,
  StudentBadge,
  Progress,
  CompletionStatus,
} from '../../shared/models/progress.model';

type FilterTab = 'all' | BadgeType;

interface BadgeCard {
  badge: Badge;
  earned: boolean;
  earnedAt?: string;
  // progress toward unlock
  progressPct: number;
  progressLabel: string;
}

@Component({
  selector: 'app-badges',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './badges.html',
})
export class BadgesComponent implements OnInit {
  readonly BadgeType = BadgeType;

  isLoading = signal(true);
  hasError  = signal(false);

  allBadges    = signal<Badge[]>([]);
  myBadges     = signal<StudentBadge[]>([]);
  myProgress   = signal<Progress[]>([]);
  activeFilter = signal<FilterTab>('all');
  hoveredId    = signal<string | null>(null);

  // ── Derived stats ──────────────────────────────────────────
  earnedCount = computed(() => this.myBadges().length);
  totalCount  = computed(() => this.allBadges().length);

  earnedPct = computed(() => {
    const t = this.totalCount();
    return t ? Math.round((this.earnedCount() / t) * 100) : 0;
  });

  totalPointsEarned = computed(() =>
    this.myProgress().reduce((s, p) => s + (p.totalPointsEarned ?? 0), 0)
  );

  passedCount = computed(() =>
    this.myProgress().filter(p => p.status === CompletionStatus.COMPLETED_PASSED).length
  );

  // ── Badge type tabs with counts ───────────────────────────
  tabs = computed(() => {
    const earned = new Set(this.myBadges().map(sb => sb.badgeId));
    const types: BadgeType[] = [
      BadgeType.COMPLETION, BadgeType.MASTERY, BadgeType.PERFECT_SCORE,
      BadgeType.STREAK, BadgeType.SPEED, BadgeType.SPECIAL,
    ];
    const result: { type: FilterTab; label: string; emoji: string; earnedCount: number; totalCount: number }[] = [
      {
        type: 'all',
        label: 'All',
        emoji: '🏆',
        earnedCount: this.earnedCount(),
        totalCount: this.totalCount(),
      },
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
    return result;
  });

  // ── Filtered + enriched badge cards ───────────────────────
  badgeCards = computed((): BadgeCard[] => {
    const earnedMap = new Map(this.myBadges().map(sb => [sb.badgeId, sb]));
    const filter = this.activeFilter();

    return this.allBadges()
      .filter(b => filter === 'all' || b.type === filter)
      .map(b => {
        const sb = earnedMap.get(b.id);
        const { pct, label } = this.calcProgress(b);
        return {
          badge: b,
          earned: !!sb,
          earnedAt: sb?.earnedAt,
          progressPct: pct,
          progressLabel: label,
        };
      })
      .sort((a, b) => {
        // Earned first, then by progress desc among locked
        if (a.earned && !b.earned) return -1;
        if (!a.earned && b.earned)  return 1;
        return b.progressPct - a.progressPct;
      });
  });

  earnedCardsCount = computed(() => this.badgeCards().filter(c => c.earned).length);
  lockedCardsCount = computed(() => this.badgeCards().filter(c => !c.earned).length);

  recentlyEarned = computed(() =>
    [...this.myBadges()]
      .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime())
      .slice(0, 6)
  );

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);

    forkJoin({
      all:      this.http.get<Badge[]>(`${environment.apiUrl}/badges`).pipe(catchError(() => of([]))),
      mine:     this.http.get<StudentBadge[]>(`${environment.apiUrl}/badges/my-badges`).pipe(catchError(() => of([]))),
      progress: this.http.get<Progress[]>(`${environment.apiUrl}/progress/my-progress`).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ all, mine, progress }) => {
        this.allBadges.set(all ?? []);
        this.myBadges.set(mine ?? []);
        this.myProgress.set(progress ?? []);
        this.isLoading.set(false);
      },
      error: () => { this.isLoading.set(false); this.hasError.set(true); },
    });
  }

  // ── Progress calculation toward locked badges ─────────────
  private calcProgress(b: Badge): { pct: number; label: string } {
    const pts     = this.totalPointsEarned();
    const passed  = this.passedCount();

    if (b.pointsRequired && b.scenariosRequired) {
      const ptsPct  = Math.min(100, Math.round((pts / b.pointsRequired) * 100));
      const scnPct  = Math.min(100, Math.round((passed / b.scenariosRequired) * 100));
      const overall = Math.round((ptsPct + scnPct) / 2);
      return {
        pct: overall,
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

  // ── Helpers ───────────────────────────────────────────────
  setFilter(t: FilterTab): void { this.activeFilter.set(t); }

  typeLabel(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION:    return 'Completion';
      case BadgeType.MASTERY:       return 'Mastery';
      case BadgeType.STREAK:        return 'Streak';
      case BadgeType.SPEED:         return 'Speed';
      case BadgeType.PERFECT_SCORE: return 'Perfect';
      case BadgeType.SPECIAL:       return 'Special';
    }
    return 'Badge';
  }

  typeEmoji(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION:    return '✅';
      case BadgeType.MASTERY:       return '🎓';
      case BadgeType.STREAK:        return '🔥';
      case BadgeType.SPEED:         return '⚡';
      case BadgeType.PERFECT_SCORE: return '💯';
      case BadgeType.SPECIAL:       return '⭐';
    }
    return '🏅';
  }

  badgeGlow(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION:    return 'shadow-[0_0_24px_rgba(16,185,129,0.35)]';
      case BadgeType.MASTERY:       return 'shadow-[0_0_24px_rgba(59,130,246,0.35)]';
      case BadgeType.STREAK:        return 'shadow-[0_0_24px_rgba(245,158,11,0.4)]';
      case BadgeType.SPEED:         return 'shadow-[0_0_24px_rgba(245,158,11,0.35)]';
      case BadgeType.PERFECT_SCORE: return 'shadow-[0_0_24px_rgba(255,77,28,0.4)]';
      case BadgeType.SPECIAL:       return 'shadow-[0_0_24px_rgba(168,85,247,0.4)]';
    }
    return '';
  }

  badgeRing(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION:    return 'border-vroom-green/40 bg-vroom-green/10';
      case BadgeType.MASTERY:       return 'border-blue-500/40 bg-blue-500/10';
      case BadgeType.STREAK:        return 'border-vroom-amber/50 bg-vroom-amber/10';
      case BadgeType.SPEED:         return 'border-vroom-amber/40 bg-vroom-amber/10';
      case BadgeType.PERFECT_SCORE: return 'border-vroom-accent/50 bg-vroom-accent/10';
      case BadgeType.SPECIAL:       return 'border-purple-500/40 bg-purple-500/10';
    }
    return 'border-vroom-border bg-vroom-card';
  }

  badgeIconColor(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION:    return 'text-vroom-green';
      case BadgeType.MASTERY:       return 'text-vroom-blue';
      case BadgeType.STREAK:        return 'text-vroom-amber';
      case BadgeType.SPEED:         return 'text-vroom-amber';
      case BadgeType.PERFECT_SCORE: return 'text-vroom-accent';
      case BadgeType.SPECIAL:       return 'text-purple-400';
    }
    return 'text-vroom-text-dim';
  }

  typeBarColor(t: BadgeType): string {
    switch (t) {
      case BadgeType.COMPLETION:    return 'bg-vroom-green';
      case BadgeType.MASTERY:       return 'bg-blue-400';
      case BadgeType.STREAK:        return 'bg-vroom-amber';
      case BadgeType.SPEED:         return 'bg-vroom-amber';
      case BadgeType.PERFECT_SCORE: return 'bg-vroom-accent';
      case BadgeType.SPECIAL:       return 'bg-purple-400';
    }
    return 'bg-vroom-border';
  }

  relativeTime(dateStr: string): string {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d < 7)  return `${d}d ago`;
    if (d < 30) return `${Math.floor(d / 7)}w ago`;
    return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  skeletons = Array(12).fill(0);
}
