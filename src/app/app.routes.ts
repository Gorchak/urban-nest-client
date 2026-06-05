import { Routes } from '@angular/router';
import { AdminAccessPageComponent } from './admin/admin-access-page/admin-access-page.component';
import { AdminCategoriesPageWithTabsComponent } from './admin/pages/admin-categories-page-with-tabs/admin-categories-page-with-tabs.component';
import { MerchandiseListComponent } from './admin/pages/merchandise-list/merchandise-list.component';
import { SalesPageComponent } from './admin/pages/sales-page/sales-page.component';
import { UsersPageComponent } from './admin/pages/users-page/users-page.component';
import { adminAccessGuard } from './core/guards/admin-access.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  { path: 'admin/access', component: AdminAccessPageComponent },
  { path: 'admin', redirectTo: 'admin/users', pathMatch: 'full' },
  { path: 'admin/categories', component: AdminCategoriesPageWithTabsComponent, canActivate: [adminAccessGuard] },
  { path: 'admin/products', component: MerchandiseListComponent, canActivate: [adminAccessGuard] },
  { path: 'admin/sales', component: SalesPageComponent, canActivate: [adminAccessGuard] },
  { path: 'admin/users', component: UsersPageComponent, canActivate: [adminAccessGuard] },
];
