import { ApplicationConfig } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAuth0 } from '@auth0/auth0-angular';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideClientHydration } from '@angular/platform-browser';

import { routes } from './app.routes';
import { authTokenInterceptor } from './core/interceptors/auth-token.interceptor';

const authProviders = typeof window === 'undefined'
  ? []
  : [
      provideAuth0({
        domain: "dev-dzbrmq5bhosgit5b.us.auth0.com",
        clientId: "e5g0EST75dgAgcy6LXHoXHUkT0hheqYV",
        cacheLocation: 'localstorage',
        authorizationParams: {
          redirect_uri: window.location.origin,
          scope: 'openid profile email',
        },
      }),
    ];

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideClientHydration(),
    provideHttpClient(withInterceptors([authTokenInterceptor])),
    provideAnimations(),
    ...authProviders,
  ]
};
