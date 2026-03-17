import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminUserDTO, SpringPage, Role } from '../../../shared/models/user.model';

type RoleFilter = 'ALL' | Role;

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-users.html',
})
export class AdminUsersComponent implements OnInit {
  private api = environment.apiUrl;
  readonly Role = Role;

  isLoading   = signal(true);
  hasError    = signal(false);
  users       = signal<AdminUserDTO[]>([]);
  searchQuery = signal('');
  roleFilter  = signal<RoleFilter>('ALL');
  sortField   = signal<'createdAt' | 'fullName' | 'role'>('createdAt');
  sortDir     = signal<'asc' | 'desc'>('desc');

  // Pagination
  currentPage   = signal(0);
  pageSize      = signal(20);
  totalElements = signal(0);
  totalPages    = signal(0);

  // Confirm delete modal
  deleteTarget = signal<AdminUserDTO | null>(null);
  isDeleting   = signal(false);

  // Role change modal
  roleTarget    = signal<AdminUserDTO | null>(null);
  newRole       = signal<Role>(Role.STUDENT);
  isChangingRole = signal(false);

  // Action feedback
  actionMessage = signal<{ text: string; ok: boolean } | null>(null);

  filtered = computed(() => {
    const q    = this.searchQuery().toLowerCase();
    const role = this.roleFilter();
    return this.users().filter(u => {
      const matchQ    = !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = role === 'ALL' || u.role === role;
      return matchQ && matchRole;
    });
  });

  counts = computed(() => {
    const all = this.users();
    return {
      all:        all.length,
      students:   all.filter(u => u.role === Role.STUDENT).length,
      instructors:all.filter(u => u.role === Role.INSTRUCTOR).length,
      admins:     all.filter(u => u.role === Role.ADMIN).length,
      disabled:   all.filter(u => !u.enabled).length,
    };
  });

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.loadPage(0); }

  loadPage(page: number): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    const sort = `${this.sortField()},${this.sortDir()}`;
    this.http.get<SpringPage<AdminUserDTO>>(
      `${this.api}/admin/users?page=${page}&size=${this.pageSize()}&sort=${sort}`
    ).pipe(catchError(() => { this.hasError.set(true); return of(null); }))
      .subscribe(page => {
        if (page) {
          this.users.set(page.content);
          this.totalElements.set(page.totalElements);
          this.totalPages.set(page.totalPages);
          this.currentPage.set(page.number);
        }
        this.isLoading.set(false);
      });
  }

  setSort(field: 'createdAt' | 'fullName' | 'role'): void {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set('desc');
    }
    this.loadPage(0);
  }

  setRoleFilter(r: string): void { this.roleFilter.set(r as RoleFilter); }

  // ── Toggle enabled/disabled ──────────────────────────────
  toggleStatus(user: AdminUserDTO): void {
    this.http.patch<AdminUserDTO>(`${this.api}/admin/users/${user.id}/status`, { enabled: !user.enabled })
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        if (updated) {
          this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
          this.flash(`${updated.fullName} ${updated.enabled ? 'activated' : 'deactivated'}.`, true);
        } else {
          this.flash('Failed to update status.', false);
        }
      });
  }

  // ── Change role ──────────────────────────────────────────
  openRoleModal(user: AdminUserDTO): void {
    this.roleTarget.set(user);
    this.newRole.set(user.role);
  }

  confirmRoleChange(): void {
    const user = this.roleTarget();
    if (!user) return;
    this.isChangingRole.set(true);
    this.http.patch<AdminUserDTO>(`${this.api}/admin/users/${user.id}/role`, { role: this.newRole() })
      .pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.isChangingRole.set(false);
        if (updated) {
          this.users.update(list => list.map(u => u.id === updated.id ? updated : u));
          this.flash(`${updated.fullName}'s role changed to ${updated.role}.`, true);
        } else {
          this.flash('Failed to change role.', false);
        }
        this.roleTarget.set(null);
      });
  }

  // ── Delete ───────────────────────────────────────────────
  confirmDelete(): void {
    const user = this.deleteTarget();
    if (!user) return;
    this.isDeleting.set(true);
    this.http.delete(`${this.api}/admin/users/${user.id}`)
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this.isDeleting.set(false);
        this.users.update(list => list.filter(u => u.id !== user.id));
        this.flash(`${user.fullName} deleted.`, true);
        this.deleteTarget.set(null);
      });
  }

  private flash(text: string, ok: boolean): void {
    this.actionMessage.set({ text, ok });
    setTimeout(() => this.actionMessage.set(null), 3500);
  }

  roleColor(role: string): string {
    return role === 'ADMIN'      ? 'bg-vroom-accent/10 border-vroom-accent/25 text-vroom-accent'
      : role === 'INSTRUCTOR' ? 'bg-blue-500/10 border-blue-500/25 text-blue-400'
        : 'bg-green-500/10 border-green-500/25 text-green-400';
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  relativeTime(d?: string): string {
    if (!d) return 'Never';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return this.formatDate(d);
  }

  initials(u: AdminUserDTO): string {
    return (u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '');
  }

  pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i));
  skeletons = Array(8).fill(0);
}
