import { Routes } from '@angular/router';
import { AdminPageComponent } from './admin/admin-page/admin-page.component';
import { AdminCategoriesPageWithTabsComponent } from './admin/pages/admin-categories-page-with-tabs/admin-categories-page-with-tabs.component';
import { MerchandiseListComponent } from './admin/pages/merchandise-list/merchandise-list.component';
import { SalesPageComponent } from './admin/pages/sales-page/sales-page.component';

export const routes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  { path: 'admin', component: AdminPageComponent },
  { path: 'admin/categories', component: AdminCategoriesPageWithTabsComponent },
  { path: 'admin/products', component: MerchandiseListComponent },
  { path: 'admin/sales', component: SalesPageComponent },
];
