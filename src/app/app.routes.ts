import { Routes } from '@angular/router';
import { AdminAccessPageComponent } from './admin/admin-access-page/admin-access-page.component';
import { AdminCategoriesPageWithTabsComponent } from './admin/pages/admin-categories-page-with-tabs/admin-categories-page-with-tabs.component';
import { FinancePageComponent } from './admin/pages/finance-page/finance-page.component';
import { MerchandiseListComponent } from './admin/pages/merchandise-list/merchandise-list.component';
import { SalesPageComponent } from './admin/pages/sales-page/sales-page.component';
import { UsersPageComponent } from './admin/pages/users-page/users-page.component';
import { HomePageComponent } from './public/home-page/home-page.component';
import { BrandsPageComponent } from './admin/pages/brands-page/brands-page.component';

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
  { path: 'brand/:slug', loadComponent: () => import('./public/brand-page/brand-page.component').then((m) => m.BrandPageComponent) },
  {
    path: 'purchase-history',
    loadComponent: () => import('./public/purchase-history-page/purchase-history-page.component').then((module) => module.PurchaseHistoryPageComponent),
  },
  {
    path: 'favorites',
    loadComponent: () => import('./public/favorites-page/favorites-page.component').then((module) => module.FavoritesPageComponent),
  },
  { path: 'admin/access', component: AdminAccessPageComponent },
  { path: 'admin', redirectTo: 'admin/users', pathMatch: 'full' },
  { path: 'admin/categories', component: AdminCategoriesPageWithTabsComponent },
  { path: 'admin/products', component: MerchandiseListComponent },
  { path: 'admin/brands', component: BrandsPageComponent },
  { path: 'admin/sales', component: SalesPageComponent },
  { path: 'admin/users', component: UsersPageComponent },
  { path: 'admin/finance', component: FinancePageComponent },
];
