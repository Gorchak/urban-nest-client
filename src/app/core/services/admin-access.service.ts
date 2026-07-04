import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { Observable, catchError, filter, map, of, switchMap, take, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Auth0User } from '../models/user.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface AdminAccessState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user: Auth0User | null;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminAccessService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/auth/me`;

  readonly currentUser = signal<Auth0User | null>(null);
  readonly isAdmin = signal(false);

  check(): Observable<AdminAccessState> {
    return this.auth.isLoading$.pipe(
      filter((isLoading) => !isLoading),
      take(1),
      timeout({ first: 4000, with: () => of(false) }),
      switchMap(() => this.auth.isAuthenticated$.pipe(
        take(1),
        timeout({ first: 3000, with: () => of(false) }),
      )),
      switchMap((isAuthenticated) => {
        if (!isAuthenticated) {
          this.currentUser.set(null);
          this.isAdmin.set(false);
          return of({ isAuthenticated: false, isAdmin: false, user: null });
        }

        return this.getIdToken().pipe(
          switchMap((token) => {
            if (!token) {
              return of({
                isAuthenticated: true,
                isAdmin: false,
                user: null,
                error: 'Не вдалося отримати токен авторизації',
              });
            }

            return this.http.get<ApiResponse<Auth0User>>(this.apiUrl, {
              headers: new HttpHeaders({ Authorization: `Bearer ${token}` }),
            }).pipe(
              timeout({ first: 10000 }),
              map((response) => {
                const user = response.data;
                return {
                  isAuthenticated: true,
                  isAdmin: user.appMetadata?.isAdmin === true || user.appMetadata?.isModerator === true,
                  user,
                };
              }),
            );
          }),
          timeout({ first: 10000 }),
          tap((state) => {
            this.currentUser.set(state.user);
            this.isAdmin.set(state.isAdmin);
          }),
          catchError((err) => {
            this.currentUser.set(null);
            this.isAdmin.set(false);
            return of({
              isAuthenticated: false,
              isAdmin: false,
              user: null,
              error: err?.error?.message || 'Не вдалося перевірити права доступу',
            });
          }),
        );
      }),
    );
  }

  private getIdToken(): Observable<string | null> {
    return this.auth.idTokenClaims$.pipe(
      take(1),
      timeout({ first: 5000, with: () => of(null) }),
      map((claims) => (claims as any)?.__raw || null),
      catchError(() => of(null)),
    );
  }
}
