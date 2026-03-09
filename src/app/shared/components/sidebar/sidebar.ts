import { Component, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { Role } from '../../models/user.model'


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
export class SidebarComponent {
  @Input() collapsed = false;
  mobileOpen = signal(false);
  readonly Role = Role;

  studentNav: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'home' },
    { label: 'Scenarios', route: '/scenarios', icon: 'scenarios' },
    { label: 'My Progress', route: '/progress', icon: 'progress' },
    { label: 'Badges', route: '/badges', icon: 'badge' },
    { label: 'Settings', route: '/settings', icon: 'settings' },
  ];

  instructorNav: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard/instructor', icon: 'home' },
    { label: 'Scenarios', route: '/instructor/scenarios', icon: 'scenarios' },
    { label: 'Students', route: '/instructor/students', icon: 'students' },
    { label: 'Video Library', route: '/instructor/videos', icon: 'video' },
    { label: 'Analytics', route: '/instructor/analytics', icon: 'progress' },
    { label: 'Settings', route: '/settings', icon: 'settings' },
  ];

  constructor(public authService: AuthService) {}

  get navItems(): NavItem[] {
    return this.authService.isInstructor() || this.authService.isAdmin()
      ? this.instructorNav
      : this.studentNav;
  }

  toggleMobile() {
    this.mobileOpen.update(v => !v);
  }
}
