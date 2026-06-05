import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAuth0 } from '@auth0/auth0-angular';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(),
    provideAnimations(),
    provideAuth0({
      domain: "dev-dzbrmq5bhosgit5b.us.auth0.com",
      clientId: "e5g0EST75dgAgcy6LXHoXHUkT0hheqYV",
      cacheLocation: 'localstorage',
      authorizationParams: {
        redirect_uri: window.location.origin,
        scope: 'openid profile email',
      },
    }),
  ]
};
