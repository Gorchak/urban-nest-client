import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { AuthService, provideAuth0 } from '@auth0/auth0-angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideClientHydration } from '@angular/platform-browser';
import { IMAGE_LOADER } from '@angular/common';
import { of } from 'rxjs';

import { routes } from './app.routes';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';
import { optimizedImageLoader } from './core/utils/image-loader';

function isSecureAuthOrigin(location: Location): boolean {
  return location.protocol === 'https:'
    || location.hostname === 'localhost'
    || location.hostname === '127.0.0.1'
    || location.hostname === '[::1]';
}

const authProviders = typeof window === 'undefined'
  ? []
  : isSecureAuthOrigin(window.location)
    ? [
      provideAuth0({
        domain: "dev-rw3536lsgv6brmz2.us.auth0.com",
        clientId: "Un3wf6HKQhDHegTcWN1AyTxRnN5YgsW9",
        cacheLocation: 'localstorage',
        authorizationParams: {
          redirect_uri: window.location.origin,
          scope: 'openid profile email',
        },
      }),
    ]
    : [
      {
        provide: AuthService,
        useValue: {
          isLoading$: of(false),
          isAuthenticated$: of(false),
          idTokenClaims$: of(null),
          user$: of(null),
          loginWithRedirect: () => undefined,
          logout: () => undefined,
        },
      },
    ];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideClientHydration(),
    provideHttpClient(withInterceptors([authTokenInterceptor])),
    provideAnimations(),
    { provide: IMAGE_LOADER, useValue: optimizedImageLoader },
    ...authProviders,
  ]
};
