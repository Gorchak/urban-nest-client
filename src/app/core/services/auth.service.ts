import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

interface ApiResponse<T> { success: boolean; message: string; data: T; }
interface AuthResult { token: string; user: User; }
interface RegistrationResult { token?: string; user?: User; requiresPasswordSetup?: boolean; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly tokenKey = 'urban_nest_auth_token';
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  private readonly authenticatedSubject = new BehaviorSubject(false);
  private readonly loadingSubject = new BehaviorSubject(true);

  readonly user$ = this.userSubject.asObservable();
  readonly isAuthenticated$ = this.authenticatedSubject.asObservable();
  readonly isLoading$ = this.loadingSubject.asObservable();
  readonly idTokenClaims$ = new BehaviorSubject<Record<string, unknown> | null>(null).asObservable();

  constructor() { void this.restoreSession(); }
  get token(): string | null { return typeof localStorage === 'undefined' ? null : localStorage.getItem(this.tokenKey); }

  async login(email: string, password: string): Promise<User> {
    const response = await firstValueFrom(this.http.post<ApiResponse<AuthResult>>(`${environment.apiUrl}/auth/login`, { email, password }));
    this.setSession(response.data); return response.data.user;
  }
  async register(data: { firstName: string; lastName: string; email: string; phone?: string; password: string }): Promise<{ user: User | null; requiresPasswordSetup: boolean; message: string }> {
    const response = await firstValueFrom(this.http.post<ApiResponse<RegistrationResult>>(`${environment.apiUrl}/auth/register`, data));
    if (response.data.requiresPasswordSetup) return { user: null, requiresPasswordSetup: true, message: response.message };
    this.setSession(response.data as AuthResult);
    return { user: response.data.user || null, requiresPasswordSetup: false, message: response.message };
  }
  async loginWithGoogle(credential: string): Promise<User> {
    const response = await firstValueFrom(this.http.post<ApiResponse<AuthResult>>(`${environment.apiUrl}/auth/google`, { credential }));
    this.setSession(response.data); return response.data.user;
  }
  forgotPassword(email: string): Promise<ApiResponse<null>> { return firstValueFrom(this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/forgot-password`, { email })); }
  resetPassword(token: string, password: string): Promise<ApiResponse<null>> { return firstValueFrom(this.http.post<ApiResponse<null>>(`${environment.apiUrl}/auth/reset-password`, { token, password })); }
  loginWithRedirect(options?: { authorizationParams?: { screen_hint?: string; redirect_uri?: string }; appState?: { target?: string } }): Promise<boolean> {
    const path = options?.authorizationParams?.screen_hint === 'signup' ? '/auth/register' : '/auth/login';
    return this.router.navigate([path], { queryParams: options?.appState?.target ? { returnUrl: options.appState.target } : undefined });
  }
  logout(_options?: unknown): void { if (typeof localStorage !== 'undefined') localStorage.removeItem(this.tokenKey); this.userSubject.next(null); this.authenticatedSubject.next(false); void this.router.navigate(['/']); }
  private setSession(result: AuthResult): void { localStorage.setItem(this.tokenKey, result.token); this.userSubject.next(result.user); this.authenticatedSubject.next(true); this.loadingSubject.next(false); }
  private async restoreSession(): Promise<void> {
    const tokenBeingRestored = this.token;
    if (!tokenBeingRestored) { this.loadingSubject.next(false); return; }
    try { const response = await firstValueFrom(this.http.get<ApiResponse<User>>(`${environment.apiUrl}/auth/me`)); this.userSubject.next(response.data); this.authenticatedSubject.next(true); }
    catch { if (this.token === tokenBeingRestored) localStorage.removeItem(this.tokenKey); }
    finally { this.loadingSubject.next(false); }
  }
}
