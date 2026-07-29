import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@auth0/auth0-angular';
import { catchError, map, of, switchMap, take, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) return next(req);
  if (typeof window === 'undefined') return next(req);

  const auth = inject(AuthService);
  const isAuthenticated$ = auth.isAuthenticated$;
  const idTokenClaims$ = auth.idTokenClaims$;

  if (!isAuthenticated$?.pipe || !idTokenClaims$?.pipe) return next(req);

  return isAuthenticated$.pipe(
    take(1),
    timeout({ first: 5000, with: () => of(false) }),
    catchError(() => of(false)),
    switchMap((isAuthenticated) => {
      if (!isAuthenticated) return next(req);

      return idTokenClaims$.pipe(
        take(1),
        timeout({ first: 5000, with: () => of(undefined) }),
        map((claims) => {
          const tokenClaims = claims as any;
          const expiresAt = Number(tokenClaims?.exp) * 1000;
          if (!tokenClaims?.__raw || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            return undefined;
          }
          return tokenClaims.__raw as string;
        }),
        catchError(() => of(undefined)),
        switchMap((token) => next(token
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req)),
      );
    }),
  );
};
