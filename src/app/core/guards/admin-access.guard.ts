import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AdminAccessService } from '../services/admin-access.service';

export const adminAccessGuard: CanActivateFn = (_route, state) => {
  const router = inject(Router);
  const adminAccess = inject(AdminAccessService);

  return adminAccess.check().pipe(
    map((access) => access.isAdmin
      ? true
      : router.createUrlTree(['/admin/access'], { queryParams: { returnUrl: state.url } })),
  );
};
