import { Component, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../shared/models/user.model';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.html'
})
export class LandingComponent implements OnInit, OnDestroy {
  readonly Role = Role;

  isScrolled = signal(false);
  mobileMenuOpen = signal(false);
  activeScenario = signal(0);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  scenarios = [
    {
      tag: 'Urban Driving',
      title: 'Rush Hour Intersection',
      description: 'Navigate a busy 4-way intersection during peak traffic with conflicting right-of-way situations.',
      difficulty: 'BEGINNER',
      duration: '5 min',
      points: 100,
      emoji: '🏙️',
      color: 'from-blue-500/20 to-blue-600/5',
      accent: 'bg-blue-500',
    },
    {
      tag: 'Night Driving',
      title: 'Low Visibility Hazards',
      description: 'Identify and react to pedestrians, cyclists and road debris in poorly lit conditions.',
      difficulty: 'INTERMEDIATE',
      duration: '8 min',
      points: 150,
      emoji: '🌙',
      color: 'from-indigo-500/20 to-indigo-600/5',
      accent: 'bg-indigo-500',
    },
    {
      tag: 'Emergency',
      title: 'Sudden Brake Failure',
      description: 'Apply emergency procedures when your vehicle experiences a critical brake system failure.',
      difficulty: 'ADVANCED',
      duration: '6 min',
      points: 200,
      emoji: '🚨',
      color: 'from-vroom-accent/20 to-vroom-accent/5',
      accent: 'bg-vroom-accent',
    },
    {
      tag: 'Weather Conditions',
      title: 'Wet Road Hydroplaning',
      description: 'Maintain control and recover safely when hydroplaning on a rain-slicked motorway.',
      difficulty: 'INTERMEDIATE',
      duration: '7 min',
      points: 175,
      emoji: '🌧️',
      color: 'from-cyan-500/20 to-cyan-600/5',
      accent: 'bg-cyan-500',
    },
  ];

  stats = [
    { value: '50+', label: 'Scenarios', sublabel: 'across 16 themes' },
    { value: '10k+', label: 'Learners', sublabel: 'actively training' },
    { value: '96%', label: 'Pass rate', sublabel: 'vs 72% national avg' },
    { value: '4.9★', label: 'Rating', sublabel: 'from certified schools' },
  ];

  features = [
    {
      icon: 'video',
      title: 'Real Driving Footage',
      description: 'Every scenario uses actual dashcam footage from real roads — not cartoons or simulators.',
    },
    {
      icon: 'pause',
      title: 'Interactive Decision Points',
      description: 'Video pauses at critical moments and asks you to assess the situation — just like real driving.',
    },
    {
      icon: 'chart',
      title: 'Instant Feedback',
      description: 'Every answer explained by certified instructors. Learn why, not just what.',
    },
    {
      icon: 'shield',
      title: 'Adaptive Difficulty',
      description: 'The platform learns your weak spots and pushes more of those scenarios your way.',
    },
    {
      icon: 'badge',
      title: 'Achievement System',
      description: 'Earn badges, level up, and build a portfolio of completed scenarios for your driving school.',
    },
    {
      icon: 'instructor',
      title: 'Instructor Tools',
      description: 'Instructors build custom scenarios, track student progress, and export reports.',
    },
  ];

  howItWorks = [
    { step: '01', title: 'Pick a scenario', desc: 'Browse by theme, difficulty or learning goal.' },
    { step: '02', title: 'Watch & decide', desc: 'Real footage plays, pauses at key moments for your input.' },
    { step: '03', title: 'Get feedback', desc: 'See exactly what you got right, wrong, and why.' },
    { step: '04', title: 'Level up', desc: 'Track progress, earn badges, tackle harder challenges.' },
  ];

  testimonials = [
    {
      name: 'Camille Rousseau',
      role: 'Student Driver',
      avatar: 'CR',
      text: 'I passed my test first try after two weeks on Vroom. The night driving scenarios were exactly what I needed — my instructor was shocked by my situational awareness.',
    },
    {
      name: 'Karim Benali',
      role: 'Driving Instructor',
      avatar: 'KB',
      text: "I've been teaching for 15 years. Vroom does in 20 minutes what used to take me an entire lesson to explain. My students arrive better prepared than ever.",
    },
    {
      name: 'Sofia Martínez',
      role: 'Student Driver',
      avatar: 'SM',
      text: 'The emergency scenarios terrified me at first. But after practising them dozens of times, I actually encountered a real brake issue and handled it calmly. This works.',
    },
  ];

  instructorPoints = [
    'Upload any video and add question overlays in minutes',
    'Set passing scores and learning objectives per scenario',
    'Track every student\'s progress, scores and time spent',
    'Export reports for driving school compliance',
    'Build a reusable question bank across all scenarios',
  ];

  miniStats = [
    { value: '24', label: 'Students' },
    { value: '87%', label: 'Avg Score' },
    { value: '12', label: 'Scenarios' },
  ];

  mockStudents = [
    { name: 'Alex Dupont', initials: 'AD', progress: '8/12 scenarios', score: 91 },
    { name: 'Maya Chen', initials: 'MC', progress: '5/12 scenarios', score: 74 },
    { name: 'Rayan Saidi', initials: 'RS', progress: '11/12 scenarios', score: 88 },
    { name: 'Laura Méndez', initials: 'LM', progress: '2/12 scenarios', score: 55 },
  ];

  footerLinks = [
    {
      heading: 'Product',
      links: [
        { label: 'Scenarios', href: '/auth/register' },
        { label: 'For instructors', href: '/auth/register' },
        { label: 'Pricing', href: '/auth/register' },
      ]
    },
    {
      heading: 'Company',
      links: [
        { label: 'About', href: '/' },
        { label: 'Blog', href: '/' },
        { label: 'Careers', href: '/' },
      ]
    },
    {
      heading: 'Support',
      links: [
        { label: 'Help center', href: '/' },
        { label: 'Contact', href: '/' },
        { label: 'Status', href: '/' },
      ]
    },
  ];

  constructor(public authService: AuthService) {}

  dashboardRoute(): string {
    const role = this.authService.currentUser()?.role;
    if (role === Role.ADMIN) return '/admin/dashboard';
    if (role === Role.INSTRUCTOR) return '/dashboard/instructor';
    return '/dashboard';
  }

  ngOnInit(): void {
    this.intervalId = setInterval(() => {
      this.activeScenario.update(i => (i + 1) % this.scenarios.length);
    }, 3500);
  }

  ngOnDestroy(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled.set(window.scrollY > 40);
  }

  toggleMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  setScenario(i: number): void {
    this.activeScenario.set(i);
  }

  difficultyColor(d: string): string {
    return d === 'BEGINNER' ? 'text-vroom-green' :
      d === 'INTERMEDIATE' ? 'text-vroom-amber' : 'text-vroom-accent';
  }
}
