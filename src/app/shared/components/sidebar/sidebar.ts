import { Component, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../models/user.model';
import { Assignment, AssignmentStatus } from '../../models/scenario.model';
import { environment } from '../../../../environments/environment';

export interface NavItem {
  label: string;
  route: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html'
})
export class SidebarComponent implements OnInit {
  mobileOpen = signal(false);
  readonly Role = Role;

  pendingAssignmentCount = signal(0);

  studentNav = computed((): NavItem[] => [
    { label: 'Dashboard',    route: '/dashboard',     icon: 'home' },
    { label: 'Scenarios',    route: '/scenarios',     icon: 'scenarios' },
    { label: 'Assignments',  route: '/assignments',   icon: 'assignments',
      badge: this.pendingAssignmentCount() > 0 ? this.pendingAssignmentCount() : undefined },
    { label: 'My Progress',  route: '/progress',      icon: 'progress' },
    { label: 'Badges',       route: '/badges',        icon: 'badge' },
    { label: 'Settings',     route: '/settings',      icon: 'settings' },
  ]);

  adminNav: NavItem[] = [
    { label: 'Dashboard',    route: '/admin/dashboard',    icon: 'home' },
    { label: 'Users',        route: '/admin/users',        icon: 'students' },
    { label: 'Instructors',  route: '/admin/instructors',  icon: 'instructor' },
    { label: 'Settings',     route: '/settings',           icon: 'settings' },
  ];

  instructorNav: NavItem[] = [
    { label: 'Dashboard',    route: '/dashboard/instructor', icon: 'home' },
    { label: 'Scenarios',    route: '/instructor/scenarios', icon: 'scenarios' },
    { label: 'Students',     route: '/instructor/students',  icon: 'students' },
    { label: 'Video Library',route: '/instructor/videos',    icon: 'video' },
    { label: 'Analytics',    route: '/instructor/analytics', icon: 'progress' },
    { label: 'Settings',     route: '/settings',             icon: 'settings' },
  ];

  constructor(
    public authService: AuthService,
    private http: HttpClient,
  ) {}

  ngOnInit(): void {
    // Only load assignment count for students
    if (!this.authService.isInstructor() && !this.authService.isAdmin() && !this.authService.currentUser()?.role?.includes('ADMIN')) {
      this.loadAssignmentCount();
    }
  }

  private loadAssignmentCount(): void {
    this.http.get<Assignment[]>(`${environment.apiUrl}/progress/my-assignments`)
      .pipe(catchError(() => of([])))
      .subscribe(assignments => {
        const count = (assignments ?? []).filter(a =>
          a.status === AssignmentStatus.PENDING || a.status === AssignmentStatus.OVERDUE
        ).length;
        this.pendingAssignmentCount.set(count);
      });
  }

  get navItems(): NavItem[] {
    if (this.authService.isAdmin()) return this.adminNav;
    if (this.authService.isInstructor()) return this.instructorNav;
    return this.studentNav();
  }

  toggleMobile(): void {
    this.mobileOpen.update(v => !v);
  }
}
