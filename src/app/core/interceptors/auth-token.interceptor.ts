import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { catchError, map, of, switchMap, take, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  if (typeof window === 'undefined') return next(req);

  const auth = inject(AuthService);

  return auth.isAuthenticated$.pipe(
    take(1),
    timeout({ first: 5000, with: () => of(false) }),
    catchError(() => of(false)),
    switchMap((isAuthenticated) => {
      if (!isAuthenticated) return next(req);

      return auth.idTokenClaims$.pipe(
        take(1),
        timeout({ first: 5000, with: () => of(undefined) }),
        map((claims) => (claims as any)?.__raw as string | undefined),
        catchError(() => of(undefined)),
        switchMap((token) => next(token
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req)),
      );
    }),
  );
};
