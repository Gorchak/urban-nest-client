import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/category.model';
import { AddEditCategoryComponent } from '../add-edit-category/add-edit-category.component';

@Component({
  selector: 'app-admin-categories-page',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    ButtonModule,
    ToastModule,
    ConfirmDialogModule,
    AddEditCategoryComponent,
  ],
  providers: [MessageService, ConfirmationService],
  templateUrl: './admin-categories-page.component.html',
  styleUrls: ['./admin-categories-page.component.scss'],
})
export class AdminCategoriesPageComponent implements OnInit {
  private categoriesService: CategoriesService = inject(CategoriesService);
  protected messageService: MessageService = inject(MessageService);
  private confirmationService: ConfirmationService = inject(ConfirmationService);

  protected categories: Category[] = [];
  protected loading = false;
  protected showDialog = false;
  protected dialogMode: 'new' | 'edit' = 'new';
  protected selectedCategory: Category | null = null;

  async ngOnInit(): Promise<void> {
    await this.loadCategories();
  }

  private async loadCategories(): Promise<void> {
    this.loading = true;
    try {
      this.categories = await this.categoriesService.getCategories();
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load categories',
      });
    } finally {
      this.loading = false;
    }
  }

  protected openNew(): void {
    this.dialogMode = 'new';
    this.selectedCategory = null;
    this.showDialog = true;
  }

  protected openEdit(category: Category): void {
    this.dialogMode = 'edit';
    this.selectedCategory = category;
    this.showDialog = true;
  }

  protected async onCategorySaved(): Promise<void> {
    await this.loadCategories();
  }

  protected confirmDelete(category: Category): void {
    this.confirmationService.confirm({
      message: `Ви впевнені, що хочете видалити "${category.name}"?`,
      header: 'Підтвердження',
      icon: 'pi pi-exclamation-triangle',
      accept: async () => {
        try {
          await this.categoriesService.deleteCategory(category._id);
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Категорію видалено',
          });
        } catch {
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Не вдалося видалити категорію',
          });
        }
      },
    });
  }
}
