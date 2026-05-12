import { Component } from '@angular/core';
import { TabViewModule } from 'primeng/tabview';
import { AdminCategoriesPageComponent } from '../admin-categories-page/admin-categories-page.component';
import { CategoryReferencesComponent } from '../category-references/category-references.component';

@Component({
  selector: 'app-admin-categories-page-with-tabs',
  standalone: true,
  imports: [TabViewModule, AdminCategoriesPageComponent, CategoryReferencesComponent],
  templateUrl: './admin-categories-page-with-tabs.component.html',
  styleUrls: ['./admin-categories-page-with-tabs.component.scss']
})
export class AdminCategoriesPageWithTabsComponent {}
