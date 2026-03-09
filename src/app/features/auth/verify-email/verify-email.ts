import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="auth-layout items-center justify-center">
      <div class="w-full max-w-md px-8 py-12 animate-fade-in text-center">
        <a routerLink="/" class="vroom-logo inline-flex items-center gap-2 mb-12 mx-auto justify-center">
          <span class="text-gradient">V</span>ROOM
        </a>

        @if (isLoading()) {
          <div class="flex flex-col items-center gap-4">
            <svg class="animate-spin w-12 h-12 text-vroom-accent" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <p class="text-vroom-text-dim font-body">Verifying your email...</p>
          </div>
        } @else if (isSuccess()) {
          <div class="animate-slide-up animate-fill-both">
            <div class="w-20 h-20 rounded-full bg-vroom-green/10 border border-vroom-green/30 flex items-center justify-center mx-auto mb-6">
              <svg class="w-10 h-10 text-vroom-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
            </div>
            <h2 class="text-2xl font-display font-bold text-vroom-text mb-3">Email verified!</h2>
            <p class="text-vroom-text-dim font-body mb-8">Your email has been verified. You're ready to start driving!</p>
            <a routerLink="/auth/login" class="btn-primary inline-flex items-center gap-2 mx-auto">
              Continue to login
            </a>
          </div>
        } @else {
          <div class="animate-slide-up animate-fill-both">
            <div class="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-6">
              <svg class="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </div>
            <h2 class="text-2xl font-display font-bold text-vroom-text mb-3">Verification failed</h2>
            <p class="text-vroom-text-dim font-body mb-8">{{ errorMessage() || 'This link is invalid or has expired.' }}</p>
            <a routerLink="/auth/login" class="btn-secondary inline-flex items-center gap-2 mx-auto">Back to login</a>
          </div>
        }
      </div>
    </div>
  `
})
export class VerifyEmailComponent implements OnInit {
  isLoading = signal(true);
  isSuccess = signal(false);
  errorMessage = signal('');

  constructor(private authService: AuthService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.isLoading.set(false);
      this.errorMessage.set('No verification token provided.');
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.isSuccess.set(true);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message ?? 'Verification failed.');
      }
    });
  }
}
