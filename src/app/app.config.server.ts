import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { AuthService } from '@auth0/auth0-angular';
import { of } from 'rxjs';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(),
    {
      provide: AuthService,
      useValue: {
        isLoading$: of(false),
        isAuthenticated$: of(false),
        idTokenClaims$: of(null),
        loginWithRedirect: () => undefined,
        logout: () => undefined,
      },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
