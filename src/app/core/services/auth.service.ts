import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthResponse, LoginRequest, RegisterRequest,
  ResetPasswordRequest, RefreshTokenRequest, User, Role
} from '../../shared/models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly apiUrl = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'vroom_token';
  private readonly REFRESH_TOKEN_KEY = 'vroom_refresh_token';
  private readonly USER_KEY = 'vroom_user';

  private _currentUser = signal<User | null>(this.loadUserFromStorage());
  private _isLoading = signal(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());
  readonly isStudent = computed(() => this._currentUser()?.role === Role.STUDENT);
  readonly isInstructor = computed(() => this._currentUser()?.role === Role.INSTRUCTOR);
  readonly isAdmin = computed(() => this._currentUser()?.role === Role.ADMIN);

  constructor(private http: HttpClient, private router: Router) {}

  login(request: LoginRequest): Observable<AuthResponse> {
    this._isLoading.set(true);
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(response => this.handleAuthSuccess(response)),
      catchError(err => {
        this._isLoading.set(false);
        return throwError(() => err);
      })
    );
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    this._isLoading.set(true);
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, request).pipe(
      tap(response => this.handleAuthSuccess(response)),
      catchError(err => {
        this._isLoading.set(false);
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    const token = this.getToken();
    this.clearSession();

    if (token) {
      this.http.post(
        `${this.apiUrl}/logout`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      ).pipe(catchError(() => of(null))).subscribe();
    }
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    const request: RefreshTokenRequest = { refreshToken: refreshToken ?? '' };
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, request).pipe(
      tap(response => {
        this.setToken(response.accessToken);
        if (response.refreshToken) {
          this.setRefreshToken(response.refreshToken);
        }
      })
    );
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap(user => {
        this._currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      })
    );
  }

  requestPasswordReset(email: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/request-reset`, { email });
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, request);
  }

  verifyEmail(token: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/verify-email?token=${token}`, {});
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  setRefreshToken(token: string): void {
    localStorage.setItem(this.REFRESH_TOKEN_KEY, token);
  }

  private handleAuthSuccess(response: AuthResponse): void {
    this.setToken(response.accessToken);
    this.setRefreshToken(response.refreshToken);

    // Build user directly from auth response — no extra HTTP call needed
    const user: User = {
      id: response.userId,
      email: response.email,
      firstName: response.firstName,
      lastName: response.lastName,
      role: response.role,
      emailVerified: response.emailVerified
    };

    this._currentUser.set(user);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this._isLoading.set(false);
    this.redirectAfterLogin();
  }

  private redirectAfterLogin(): void {
    const user = this._currentUser();
    if (user?.role === Role.INSTRUCTOR || user?.role === Role.ADMIN) {
      this.router.navigate(['/dashboard/instructor']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  private clearSession(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this._currentUser.set(null);
    this.router.navigate(['/auth/login']);
  }

  private loadUserFromStorage(): User | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) return null;
    try {
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  }
}