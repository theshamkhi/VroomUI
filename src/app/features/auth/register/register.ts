import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { RegisterRequest, Role } from '../../../shared/models/user.model';
import { HttpErrorResponse } from '@angular/common/http';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  if (password && confirmPassword && password.value !== confirmPassword.value) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.html'
})
export class RegisterComponent {
  registerForm: FormGroup;
  errorMessage = signal('');
  showPassword = signal(false);
  isSubmitting = signal(false);
  selectedRole = signal<Role>(Role.STUDENT);
  readonly Role = Role;

  features = [
    { text: 'Dynamic video-based driving scenarios' },
    { text: 'Real-time feedback and explanations' },
    { text: 'Progress tracking & achievement badges' },
    { text: 'Certified instructor-created content' },
  ];

  constructor(private fb: FormBuilder, public authService: AuthService) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&].*$/)]],
      confirmPassword: ['', [Validators.required]],
      role: [Role.STUDENT, Validators.required]
    }, { validators: passwordMatchValidator });
  }

  get f() { return this.registerForm.controls; }

  selectRole(role: Role): void {
    this.selectedRole.set(role);
    this.registerForm.patchValue({ role });
  }

  togglePassword() { this.showPassword.update(v => !v); }

  getPasswordStrength(): { level: number; label: string; color: string } {
    const password = this.f['password'].value as string ?? '';
    let level = 0;
    if (password.length >= 8) level++;
    if (/[A-Z]/.test(password)) level++;
    if (/[0-9]/.test(password)) level++;
    if (/[@$!%*?&]/.test(password)) level++;

    const map = [
      { label: '', color: '' },
      { label: 'Weak', color: 'bg-red-500' },
      { label: 'Fair', color: 'bg-amber-500' },
      { label: 'Good', color: 'bg-blue-500' },
      { label: 'Strong', color: 'bg-vroom-green' },
    ];
    return { level, ...map[level] };
  }

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const { confirmPassword, ...formData } = this.registerForm.value;
    const request: RegisterRequest = formData;

    this.authService.register(request).subscribe({
      error: (err: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        if (err.status === 409) {
          this.errorMessage.set('An account with this email already exists.');
        } else if (err.error?.validationErrors) {
          const errors = Object.values(err.error.validationErrors).join(', ');
          this.errorMessage.set(errors);
        } else {
          this.errorMessage.set(err.error?.message ?? 'Registration failed. Please try again.');
        }
      }
    });
  }
}
