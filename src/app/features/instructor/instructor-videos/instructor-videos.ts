import { Component, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Video, VideoStatus } from '../../../shared/models/api.model';

type SortField = 'title' | 'status' | 'size' | 'views' | 'created';
type StatusFilter = 'ALL' | VideoStatus;
type ViewMode = 'grid' | 'list';

@Component({
  selector: 'app-instructor-videos',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './instructor-videos.html',
})
export class InstructorVideosComponent implements OnInit, OnDestroy {
  readonly VideoStatus = VideoStatus;

  isLoading     = signal(true);
  hasError      = signal(false);
  videos        = signal<Video[]>([]);
  searchQuery   = signal('');
  statusFilter  = signal<StatusFilter>('ALL');
  sortField     = signal<SortField>('created');
  sortDir       = signal<'asc' | 'desc'>('desc');
  viewMode      = signal<ViewMode>('grid');

  // Upload state
  isDragging    = signal(false);
  isUploading   = signal(false);
  uploadProgress = signal(0);
  uploadTitle   = signal('');
  uploadFile    = signal<File | null>(null);
  uploadError   = signal<string | null>(null);
  showUploadPanel = signal(false);

  // Delete state
  confirmDeleteId = signal<string | null>(null);
  isDeleting      = signal(false);
  deleteError     = signal<string | null>(null);

  // Preview state
  previewVideo  = signal<Video | null>(null);
  blobPreviewUrl = signal<string | null>(null);
  isLoadingPreview = signal(false);

  filtered = computed(() => {
    const q   = this.searchQuery().toLowerCase();
    const sf  = this.statusFilter();
    const sort = this.sortField();
    const dir  = this.sortDir();

    let list = this.videos().filter(v => {
      const matchQ  = !q || v.title.toLowerCase().includes(q) || (v.originalFilename ?? '').toLowerCase().includes(q);
      const matchSt = sf === 'ALL' || v.status === sf;
      return matchQ && matchSt;
    });

    list = [...list].sort((a, b) => {
      let va: string | number, vb: string | number;
      switch (sort) {
        case 'title':   va = a.title; vb = b.title; break;
        case 'status':  va = a.status; vb = b.status; break;
        case 'size':    va = a.fileSizeBytes ?? 0; vb = b.fileSizeBytes ?? 0; break;
        case 'views':   va = a.viewCount ?? 0; vb = b.viewCount ?? 0; break;
        case 'created':
        default:        va = new Date(a.createdAt).getTime(); vb = new Date(b.createdAt).getTime();
      }
      const cmp = typeof va === 'string' ? va.localeCompare(vb as string) : (va as number) - (vb as number);
      return dir === 'asc' ? cmp : -cmp;
    });

    return list;
  });

  counts = computed(() => {
    const vs = this.videos();
    return {
      all:        vs.length,
      ready:      vs.filter(v => v.status === VideoStatus.READY).length,
      processing: vs.filter(v => v.status === VideoStatus.PROCESSING || v.status === VideoStatus.UPLOADING).length,
      failed:     vs.filter(v => v.status === VideoStatus.FAILED).length,
    };
  });

  totalSize = computed(() => {
    const bytes = this.videos().reduce((s, v) => s + (v.fileSizeBytes ?? 0), 0);
    return this.formatBytes(bytes);
  });

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void {
    const url = this.blobPreviewUrl();
    if (url) URL.revokeObjectURL(url);
  }

  load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.http.get<Video[]>(`${environment.apiUrl}/videos/my-videos`)
      .pipe(catchError(() => of(null)))
      .subscribe(vs => {
        if (vs === null) { this.hasError.set(true); }
        else { this.videos.set(vs); }
        this.isLoading.set(false);
      });
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as StatusFilter);
  }

  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDir.set(field === 'created' ? 'desc' : 'asc');
    }
  }

  // ── Upload ────────────────────────────────────────────────
  onDragOver(e: DragEvent): void { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave(): void { this.isDragging.set(false); }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragging.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) this.setUploadFile(file);
  }

  onFileChange(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) this.setUploadFile(file);
  }

  setUploadFile(file: File): void {
    this.uploadFile.set(file);
    if (!this.uploadTitle()) this.uploadTitle.set(file.name.replace(/\.[^.]+$/, ''));
    this.uploadError.set(null);
    this.showUploadPanel.set(true);
  }

  startUpload(): void {
    const file = this.uploadFile();
    if (!file) return;
    this.isUploading.set(true);
    this.uploadProgress.set(0);
    this.uploadError.set(null);

    const fd = new FormData();
    fd.append('file', file);
    fd.append('title', this.uploadTitle() || file.name);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${environment.apiUrl}/videos/upload`);
    const token = localStorage.getItem('vroom_token');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) this.uploadProgress.set(Math.round(e.loaded / e.total * 100));
    });

    xhr.addEventListener('load', () => {
      this.isUploading.set(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        const video: Video = JSON.parse(xhr.responseText);
        this.videos.update(vs => [video, ...vs]);
        this.resetUpload();
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          this.uploadError.set(err?.message ?? 'Upload failed.');
        } catch { this.uploadError.set('Upload failed.'); }
      }
    });

    xhr.addEventListener('error', () => {
      this.isUploading.set(false);
      this.uploadError.set('Network error during upload.');
    });

    xhr.send(fd);
  }

  resetUpload(): void {
    this.uploadFile.set(null);
    this.uploadTitle.set('');
    this.uploadProgress.set(0);
    this.uploadError.set(null);
    this.showUploadPanel.set(false);
    this.isUploading.set(false);
  }

  // ── Delete ────────────────────────────────────────────────
  promptDelete(id: string, e: Event): void {
    e.stopPropagation();
    this.confirmDeleteId.set(id);
    this.deleteError.set(null);
  }

  cancelDelete(): void { this.confirmDeleteId.set(null); }

  confirmDelete(): void {
    const id = this.confirmDeleteId();
    if (!id || this.isDeleting()) return;
    this.isDeleting.set(true);
    this.http.delete(`${environment.apiUrl}/videos/${id}`)
      .pipe(catchError(err => {
        this.deleteError.set(err?.error?.message ?? 'Could not delete video.');
        this.isDeleting.set(false);
        return of(null);
      }))
      .subscribe(res => {
        if (res !== null || !this.deleteError()) {
          this.videos.update(vs => vs.filter(v => v.id !== id));
          this.confirmDeleteId.set(null);
        }
        this.isDeleting.set(false);
      });
  }

  // ── Preview ───────────────────────────────────────────────
  openPreview(v: Video, e: Event): void {
    e.stopPropagation();
    if (v.status !== VideoStatus.READY) return;
    this.previewVideo.set(v);
    this.blobPreviewUrl.set(null);
    this.isLoadingPreview.set(true);

    const token = localStorage.getItem('vroom_token');
    const url = v.videoUrl?.startsWith('http') ? v.videoUrl : `${environment.apiUrl}/videos/stream/${v.id}`;

    if (token) {
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => {
          if (!r.ok) throw new Error();
          return r.blob();
        })
        .then(blob => {
          this.blobPreviewUrl.set(URL.createObjectURL(blob));
          this.isLoadingPreview.set(false);
        })
        .catch(() => {
          this.blobPreviewUrl.set(url);
          this.isLoadingPreview.set(false);
        });
    } else {
      this.blobPreviewUrl.set(url);
      this.isLoadingPreview.set(false);
    }
  }

  closePreview(): void {
    const url = this.blobPreviewUrl();
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    this.previewVideo.set(null);
    this.blobPreviewUrl.set(null);
  }

  useInScenario(v: Video): void {
    this.router.navigate(['/instructor/scenarios/new'], { queryParams: { videoId: v.id } });
  }

  // ── Helpers ───────────────────────────────────────────────
  statusBadge(s: VideoStatus): string {
    switch (s) {
      case VideoStatus.READY:      return 'bg-green-500/10 border-green-500/25 text-green-400';
      case VideoStatus.PROCESSING: return 'bg-amber-500/10 border-amber-500/25 text-amber-400';
      case VideoStatus.UPLOADING:  return 'bg-blue-500/10 border-blue-500/25 text-blue-400';
      case VideoStatus.FAILED:     return 'bg-red-500/10 border-red-500/25 text-red-400';
      case VideoStatus.DELETED:    return 'bg-vroom-surface border-vroom-border text-vroom-muted';
    }
  }

  statusDot(s: VideoStatus): string {
    switch (s) {
      case VideoStatus.READY:      return 'bg-green-400';
      case VideoStatus.PROCESSING: return 'bg-amber-400 animate-pulse';
      case VideoStatus.UPLOADING:  return 'bg-blue-400 animate-pulse';
      case VideoStatus.FAILED:     return 'bg-red-400';
      case VideoStatus.DELETED:    return 'bg-vroom-muted';
    }
  }

  formatBytes(b: number): string {
    if (!b) return '0 B';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  formatDuration(s?: number): string {
    if (!s) return '—';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  relativeTime(d: string): string {
    if (!d) return '—';
    const diff = Date.now() - new Date(d).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  sortIcon(f: SortField): string {
    if (this.sortField() !== f) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }

  skeletons = Array(6).fill(0);
}
