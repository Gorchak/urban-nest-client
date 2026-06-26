import { Routes } from '@angular/router';
import { AdminAccessPageComponent } from './admin/admin-access-page/admin-access-page.component';
import { AdminCategoriesPageWithTabsComponent } from './admin/pages/admin-categories-page-with-tabs/admin-categories-page-with-tabs.component';
import { MerchandiseListComponent } from './admin/pages/merchandise-list/merchandise-list.component';
import { SalesPageComponent } from './admin/pages/sales-page/sales-page.component';
import { UsersPageComponent } from './admin/pages/users-page/users-page.component';
import { adminAccessGuard } from './core/guards/admin-access.guard';
import { HomePageComponent } from './public/home-page/home-page.component';

export const routes: Routes = [
  { path: '', component: HomePageComponent, pathMatch: 'full' },
  {
    path: 'new-arrivals',
    loadComponent: () => import('./public/new-arrivals-page/new-arrivals-page.component').then((module) => module.NewArrivalsPageComponent),
  },
  {
    path: 'category/:slug',
    loadComponent: () => import('./public/category-page/category-page.component').then((module) => module.CategoryPageComponent),
  },
  {
    path: 'product/:slug',
    loadComponent: () => import('./public/product-page/product-page.component').then((module) => module.ProductPageComponent),
  },
  {
    path: 'checkout',
    loadComponent: () => import('./public/checkout-page/checkout-page.component').then((module) => module.CheckoutPageComponent),
  },
  {
    path: 'purchase-history',
    loadComponent: () => import('./public/purchase-history-page/purchase-history-page.component').then((module) => module.PurchaseHistoryPageComponent),
  },
  { path: 'admin/access', component: AdminAccessPageComponent },
  { path: 'admin', redirectTo: 'admin/users', pathMatch: 'full' },
  { path: 'admin/categories', component: AdminCategoriesPageWithTabsComponent, canActivate: [adminAccessGuard] },
  { path: 'admin/products', component: MerchandiseListComponent, canActivate: [adminAccessGuard] },
  { path: 'admin/sales', component: SalesPageComponent, canActivate: [adminAccessGuard] },
  { path: 'admin/users', component: UsersPageComponent, canActivate: [adminAccessGuard] },
];
