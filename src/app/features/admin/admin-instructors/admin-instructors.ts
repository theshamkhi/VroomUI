import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminInstructorDTO, SpringPage } from '../../../shared/models/user.model';

type StatusFilter = 'ALL' | 'APPROVED' | 'PENDING';

@Component({
  selector: 'app-admin-instructors',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './admin-instructors.html',
})
export class AdminInstructorsComponent implements OnInit {
  private api = environment.apiUrl;

  isLoading    = signal(true);
  hasError     = signal(false);
  instructors  = signal<AdminInstructorDTO[]>([]);
  searchQuery  = signal('');
  statusFilter = signal<StatusFilter>('ALL');

  // Pagination
  currentPage   = signal(0);
  totalElements = signal(0);
  totalPages    = signal(0);
  pageSize      = 20;

  // Action feedback
  actionMessage = signal<{ text: string; ok: boolean } | null>(null);
  processingId  = signal<string | null>(null);

  // Selected instructor detail panel
  selected = signal<AdminInstructorDTO | null>(null);

  filtered = computed(() => {
    const q  = this.searchQuery().toLowerCase();
    const sf = this.statusFilter();
    return this.instructors().filter(i => {
      const matchQ = !q || i.fullName.toLowerCase().includes(q) || i.email.toLowerCase().includes(q)
        || (i.drivingSchool ?? '').toLowerCase().includes(q);
      const matchS = sf === 'ALL'
        || (sf === 'APPROVED' && i.enabled)
        || (sf === 'PENDING'  && !i.enabled);
      return matchQ && matchS;
    });
  });

  counts = computed(() => ({
    all:      this.instructors().length,
    approved: this.instructors().filter(i => i.enabled).length,
    pending:  this.instructors().filter(i => !i.enabled).length,
  }));

  constructor(private http: HttpClient) {}

  ngOnInit(): void { this.loadPage(0); }

  loadPage(page: number): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.http.get<SpringPage<AdminInstructorDTO>>(
      `${this.api}/admin/instructors?page=${page}&size=${this.pageSize}&sort=createdAt,desc`
    ).pipe(catchError(() => { this.hasError.set(true); return of(null); }))
      .subscribe(p => {
        if (p) {
          this.instructors.set(p.content);
          this.totalElements.set(p.totalElements);
          this.totalPages.set(p.totalPages);
          this.currentPage.set(p.number);
        }
        this.isLoading.set(false);
      });
  }

  setStatusFilter(v: string): void { this.statusFilter.set(v as StatusFilter); }

  approve(instructor: AdminInstructorDTO): void  { this.setEnabled(instructor, true); }
  suspend(instructor: AdminInstructorDTO): void  { this.setEnabled(instructor, false); }

  private setEnabled(instructor: AdminInstructorDTO, enabled: boolean): void {
    this.processingId.set(instructor.id);
    this.http.patch<AdminInstructorDTO>(
      `${this.api}/admin/instructors/${instructor.id}/approve`,
      { enabled }
    ).pipe(catchError(() => of(null)))
      .subscribe(updated => {
        this.processingId.set(null);
        if (updated) {
          this.instructors.update(list => list.map(i => i.id === updated.id ? updated : i));
          if (this.selected()?.id === updated.id) this.selected.set(updated);
          this.flash(`${updated.fullName} ${enabled ? 'approved' : 'suspended'}.`, true);
        } else {
          this.flash('Action failed.', false);
        }
      });
  }

  private flash(text: string, ok: boolean): void {
    this.actionMessage.set({ text, ok });
    setTimeout(() => this.actionMessage.set(null), 3500);
  }

  formatDate(d?: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  initials(i: AdminInstructorDTO): string {
    return (i.firstName?.[0] ?? '') + (i.lastName?.[0] ?? '');
  }

  stars(rating?: number): string {
    if (!rating) return '—';
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }

  pages = computed(() => Array.from({ length: this.totalPages() }, (_, i) => i));
  skeletons = Array(6).fill(0);
}
