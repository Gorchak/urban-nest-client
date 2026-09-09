import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, filter, map, of, switchMap, take, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';

interface ApiResponse<T> { success: boolean; message: string; data: T; }
export interface AdminAccessState { isAuthenticated: boolean; isAdmin: boolean; user: User | null; error?: string; }

@Injectable({ providedIn: 'root' })
export class AdminAccessService {
  private http = inject(HttpClient); private auth = inject(AuthService); private readonly apiUrl = `${environment.apiUrl}/auth/me`;
  readonly currentUser = signal<User | null>(null); readonly isAdmin = signal(false);
  check(): Observable<AdminAccessState> {
    return this.auth.isLoading$.pipe(
      filter((loading) => !loading), take(1), timeout({ first: 5000, with: () => of(false) }),
      switchMap(() => this.auth.isAuthenticated$.pipe(take(1))),
      switchMap((authenticated): Observable<AdminAccessState> => authenticated
        ? this.http.get<ApiResponse<User>>(this.apiUrl).pipe(map((response) => ({ isAuthenticated: true, isAdmin: response.data.appMetadata?.isAdmin === true || response.data.appMetadata?.isModerator === true, user: response.data })))
        : of({ isAuthenticated: false, isAdmin: false, user: null })),
      tap((state) => { this.currentUser.set(state.user); this.isAdmin.set(state.isAdmin); }),
      catchError((err) => { this.currentUser.set(null); this.isAdmin.set(false); return of({ isAuthenticated: false, isAdmin: false, user: null, error: err?.error?.message || 'Не вдалося перевірити права доступу' }); }),
    );
  }
}
