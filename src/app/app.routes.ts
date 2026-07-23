import { Routes } from '@angular/router';
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
  { path: 'brand/:slug', loadComponent: () => import('./public/brand-page/brand-page.component').then((m) => m.BrandPageComponent) },
  {
    path: 'purchase-history',
    loadComponent: () => import('./public/purchase-history-page/purchase-history-page.component').then((module) => module.PurchaseHistoryPageComponent),
  },
  {
    path: 'favorites',
    loadComponent: () => import('./public/favorites-page/favorites-page.component').then((module) => module.FavoritesPageComponent),
  },
  {
    path: 'delivery-and-payment',
    data: { page: 'delivery' },
    loadComponent: () => import('./public/info-page/info-page.component').then((module) => module.InfoPageComponent),
  },
  {
    path: 'returns-and-exchanges',
    data: { page: 'returns' },
    loadComponent: () => import('./public/info-page/info-page.component').then((module) => module.InfoPageComponent),
  },
  {
    path: 'contacts',
    data: { page: 'contacts' },
    loadComponent: () => import('./public/info-page/info-page.component').then((module) => module.InfoPageComponent),
  },
  {
    path: 'public-offer',
    data: { page: 'offer' },
    loadComponent: () => import('./public/info-page/info-page.component').then((module) => module.InfoPageComponent),
  },
  {
    path: 'privacy-policy',
    data: { page: 'privacy' },
    loadComponent: () => import('./public/info-page/info-page.component').then((module) => module.InfoPageComponent),
  },
  {
    path: 'admin/access',
    loadComponent: () => import('./admin/admin-access-page/admin-access-page.component').then((module) => module.AdminAccessPageComponent),
  },
  { path: 'admin', redirectTo: 'admin/users', pathMatch: 'full' },
  {
    path: 'admin/categories',
    loadComponent: () => import('./admin/pages/admin-categories-page-with-tabs/admin-categories-page-with-tabs.component').then((module) => module.AdminCategoriesPageWithTabsComponent),
  },
  {
    path: 'admin/products',
    loadComponent: () => import('./admin/pages/merchandise-list/merchandise-list.component').then((module) => module.MerchandiseListComponent),
  },
  {
    path: 'admin/brands',
    loadComponent: () => import('./admin/pages/brands-page/brands-page.component').then((module) => module.BrandsPageComponent),
  },
  {
    path: 'admin/sales',
    loadComponent: () => import('./admin/pages/sales-page/sales-page.component').then((module) => module.SalesPageComponent),
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./admin/pages/users-page/users-page.component').then((module) => module.UsersPageComponent),
  },
  {
    path: 'admin/finance',
    loadComponent: () => import('./admin/pages/finance-page/finance-page.component').then((module) => module.FinancePageComponent),
  },
];
