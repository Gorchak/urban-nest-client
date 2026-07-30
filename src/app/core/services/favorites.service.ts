import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '@auth0/auth0-angular';
import { catchError, filter, firstValueFrom, of, take, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Favorite } from '../models/favorite.model';

interface ApiResponse<T> { success: boolean; message: string; data: T; }

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/favorites`;

  favorites = signal<Favorite[]>([]);
  loading = signal(false);
  ids = computed(() => new Set(this.favorites().map((favorite) => favorite.merchandiseId)));
  count = computed(() => this.favorites().length);

  async isAuthenticated(): Promise<boolean> {
    const isLoading$ = this.auth.isLoading$;
    const isAuthenticated$ = this.auth.isAuthenticated$;
    if (!isLoading$?.pipe || !isAuthenticated$?.pipe) return false;

    await firstValueFrom(isLoading$.pipe(
      filter((loading) => !loading),
      take(1),
      timeout({ first: 5000, with: () => of(false) }),
      catchError(() => of(false)),
    ));

    const authenticated = await firstValueFrom(isAuthenticated$.pipe(
      take(1),
      timeout({ first: 5000, with: () => of(false) }),
      catchError(() => of(false)),
    ));
    if (!authenticated) return false;

    const claims$ = this.auth.idTokenClaims$;
    if (!claims$?.pipe) return false;
    const claims = await firstValueFrom(claims$.pipe(
      take(1),
      timeout({ first: 5000, with: () => of(null) }),
      catchError(() => of(null)),
    )) as any;
    const expiresAt = Number(claims?.exp) * 1000;
    return Boolean(claims?.__raw && Number.isFinite(expiresAt) && expiresAt > Date.now());
  }

  async load(): Promise<Favorite[]> {
    if (!(await this.isAuthenticated())) {
      this.favorites.set([]);
      return [];
    }

    this.loading.set(true);
    try {
      const response = await firstValueFrom(this.http.get<ApiResponse<Favorite[]>>(this.apiUrl));
      this.favorites.set(response.data);
      return response.data;
    } finally {
      this.loading.set(false);
    }
  }

  async add(merchandiseId: string): Promise<Favorite> {
    const response = await firstValueFrom(this.http.post<ApiResponse<Favorite>>(this.apiUrl, { merchandiseId }));
    this.favorites.update((favorites) => {
      const withoutCurrent = favorites.filter((favorite) => favorite.merchandiseId !== response.data.merchandiseId);
      return [response.data, ...withoutCurrent];
    });
    return response.data;
  }

  async remove(merchandiseId: string): Promise<void> {
    await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${encodeURIComponent(merchandiseId)}`));
    this.favorites.update((favorites) => favorites.filter((favorite) => favorite.merchandiseId !== merchandiseId));
  }

  has(merchandiseId: string): boolean {
    return this.ids().has(merchandiseId);
  }

  login(target = window.location.pathname + window.location.search): void {
    this.auth.loginWithRedirect({
      appState: { target },
      authorizationParams: { redirect_uri: window.location.origin },
    });
  }
}
