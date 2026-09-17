import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

export const AUTH_TOKEN_STORAGE_KEY = 'urban_nest_auth_token';
const AUTH_USER_STORAGE_KEY = 'urban_nest_auth_user';

interface ApiResponse<T> { success: boolean; message: string; data: T; }
interface AuthResult { token: string; user: User; }
interface RegistrationResult { token?: string; user?: User; requiresPasswordSetup?: boolean; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly userSubject = new BehaviorSubject<User | null>(null);
  private readonly authenticatedSubject = new BehaviorSubject(false);
  private readonly loadingSubject = new BehaviorSubject(true);

  readonly user$ = this.userSubject.asObservable();
  readonly isAuthenticated$ = this.authenticatedSubject.asObservable();
  readonly isLoading$ = this.loadingSubject.asObservable();
  readonly idTokenClaims$ = new BehaviorSubject<Record<string, unknown> | null>(null).asObservable();

  constructor() { void this.restoreSession(); }
  get token(): string | null { return typeof localStorage === 'undefined' ? null : localStorage.getItem(AUTH_TOKEN_STORAGE_KEY); }

  async login(email: string, password: string): Promise<User> {
    const response = await firstValueFrom(this.http.post<ApiResponse<AuthResult>>(`${environment.apiUrl}/auth/login`, { email, password }));
    this.setSession(response.data); return response.data.user;
  }
  async register(data: { firstName: string; lastName: string; middleName: string; email: string; phone?: string; password: string }): Promise<{ user: User | null; requiresPasswordSetup: boolean; message: string }> {
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
  logout(_options?: unknown): void { this.clearStoredSession(); this.userSubject.next(null); this.authenticatedSubject.next(false); this.loadingSubject.next(false); void this.router.navigate(['/']); }
  private setSession(result: AuthResult): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, result.token);
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(result.user));
    }
    this.userSubject.next(result.user);
    this.authenticatedSubject.next(true);
    this.loadingSubject.next(false);
  }
  private async restoreSession(): Promise<void> {
    const tokenBeingRestored = this.token;
    if (!tokenBeingRestored) { this.loadingSubject.next(false); return; }
    const cachedUser = this.readStoredUser();
    if (cachedUser) {
      this.userSubject.next(cachedUser);
      this.authenticatedSubject.next(true);
    }
    try {
      const response = await firstValueFrom(this.http.get<ApiResponse<User>>(`${environment.apiUrl}/auth/me`));
      this.userSubject.next(response.data);
      this.authenticatedSubject.next(true);
      if (typeof localStorage !== 'undefined') localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(response.data));
    } catch (error: any) {
      if ([401, 403].includes(Number(error?.status)) && this.token === tokenBeingRestored) {
        this.clearStoredSession();
        this.userSubject.next(null);
        this.authenticatedSubject.next(false);
      }
    }
    finally { this.loadingSubject.next(false); }
  }
  private readStoredUser(): User | null {
    if (typeof localStorage === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem(AUTH_USER_STORAGE_KEY) || 'null') as User | null; }
    catch { localStorage.removeItem(AUTH_USER_STORAGE_KEY); return null; }
  }
  private clearStoredSession(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  }
}
