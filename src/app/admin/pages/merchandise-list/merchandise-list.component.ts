import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { CheckboxModule } from 'primeng/checkbox';
import { TagModule } from 'primeng/tag';
import { ImageModule } from 'primeng/image';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { BadgeModule } from 'primeng/badge';
import { TooltipModule } from 'primeng/tooltip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { MessageService, ConfirmationService } from 'primeng/api';

import { CategoriesService } from '../../../core/services/categories.service';
import { MerchandiseService } from '../../../core/services/merchandise.service';
import { Category } from '../../../core/models/category.model';
import { Merchandise, MerchandiseListFilter, MerchandisePagination, MerchandiseListResponse } from '../../../core/models/merchandise.model';
import { AddEditMerchandiseComponent } from '../add-edit-merchandise/add-edit-merchandise.component';
import { MerchandiseDetailsComponent } from '../merchandise-details/merchandise-details.component';

interface SubcategoryOption {
  label: string;
  value: string;
}

interface StockEditState {
  originalValue: number;
  newValue: number;
}

@Component({
  selector: 'app-merchandise-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService, ConfirmationService],
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    ButtonModule,
    ToastModule,
    ConfirmDialogModule,
    TabViewModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
    CheckboxModule,
    TagModule,
    ImageModule,
    SkeletonModule,
    DividerModule,
    BadgeModule,
    TooltipModule,
    IconFieldModule,
    InputIconModule,
    AddEditMerchandiseComponent,
    MerchandiseDetailsComponent,
  ],
  templateUrl: './merchandise-list.component.html',
  styleUrls: ['./merchandise-list.component.scss'],
})
export class MerchandiseListComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);
  private cdr = inject(ChangeDetectorRef);

  // ── Categories (tabs) ─────────────────────────────────────────────────────
  protected categories = signal<Category[]>([]);
  protected activeTabIndex = signal(0);
  protected subcategories = signal<SubcategoryOption[]>([]);
  protected selectedSubcategoryId = signal<string | null>(null);

  /** Subcategory dropdown options: "All" option prepended to the subcategories list */
  protected subcategoryOptions = computed<SubcategoryOption[]>(() => [
    { label: 'Всі підкатегорії', value: '' },
    ...this.subcategories(),
  ]);

  protected activeCategory = computed<Category | null>(() => {
    const tabs = this.tabCategories();
    const idx = this.activeTabIndex();
    if (idx === 0) return null; // "Всі товари"
    return tabs[idx - 1] ?? null;
  });

  protected hasSubcategories = computed(() => this.subcategories().length > 0);

  /** All subcategory IDs for the current parent category (for bulk loading) */
  protected subcategoryIds = computed<string[]>(() =>
    this.subcategories().map(s => s.value)
  );

  /** Only root-level active categories shown as tabs */
  protected tabCategories = computed(() =>
    this.categories().filter((c) => !c.parentId && c.isActive)
  );

  // ── Merchandise list ──────────────────────────────────────────────────────
  protected merchandise = signal<Merchandise[]>([]);
  protected pagination = signal<MerchandisePagination>({ total: 0, page: 1, limit: 20, pages: 0 });
  protected loading = signal(false);
  protected loadingCategories = signal(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  protected searchQuery = signal('');
  protected filterIsActive = signal<boolean | null>(null);
  protected filterInStock = signal<boolean | null>(null);
  protected filterMinPrice = signal<number | null>(null);
  protected filterMaxPrice = signal<number | null>(null);

  // ── Sorting ───────────────────────────────────────────────────────────────
  protected sortBy = signal<string>('createdAt');
  protected sortOrder = signal<'asc' | 'desc'>('desc');

  // ── Add/Edit dialog ───────────────────────────────────────────────────────
  protected showDialog = signal(false);
  protected dialogMode = signal<'new' | 'edit'>('new');
  protected selectedMerchandise = signal<Merchandise | null>(null);

  // ── Details dialog ────────────────────────────────────────────────────────
  protected showDetailsDialog = signal(false);
  protected detailsMerchandiseId = signal<string | null>(null);

  readonly sortOptions = [
    { label: 'Дата (нові)', value: 'createdAt_desc' },
    { label: 'Дата (старі)', value: 'createdAt_asc' },
    { label: 'Назва А-Я', value: 'name_asc' },
    { label: 'Назва Я-А', value: 'name_desc' },
    { label: 'Ціна ↑', value: 'salePrice_asc' },
    { label: 'Ціна ↓', value: 'salePrice_desc' },
    { label: 'Склад ↑', value: 'stockQuantity_asc' },
    { label: 'Склад ↓', value: 'stockQuantity_desc' },
  ];

  protected selectedSort = signal('createdAt_desc');

  readonly activeFilterOptions = [
    { label: 'Всі', value: null },
    { label: 'Активні', value: true },
    { label: 'Неактивні', value: false },
  ];

  readonly stockFilterOptions = [
    { label: 'Всі', value: null },
    { label: 'В наявності', value: 'inStock' },
    { label: 'Немає в наявності', value: 'outOfStock' },
  ];

  protected selectedStockFilter = signal<string | null>(null);

  // ── Stock editing ───────────────────────────────────────────────────────
  protected stockEdits = signal<Map<string, StockEditState>>(new Map());
  protected submittingStock = signal<Set<string>>(new Set());

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async ngOnInit(): Promise<void> {
    await this.loadCategories();
    await this.loadMerchandise();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private async loadCategories(): Promise<void> {
    this.loadingCategories.set(true);
    try {
      const cats = await this.categoriesService.getCategories(1, 200);
      this.categories.set(cats.filter((c) => c.isActive));
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Помилка', detail: 'Не вдалося завантажити категорії' });
    } finally {
      this.loadingCategories.set(false);
      this.cdr.markForCheck();
    }
  }

  async loadMerchandise(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.fetchMerchandiseForFilter();

      this.merchandise.set(result.data);
      this.pagination.set(result.pagination);
    } catch {
      this.messageService.add({ severity: 'error', summary: 'Помилка', detail: 'Не вдалося завантажити товари' });
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  private async fetchMerchandiseForFilter(): Promise<MerchandiseListResponse> {
    const cat = this.activeCategory();
    const subId = this.selectedSubcategoryId();

    if (subId) {
      // Specific subcategory selected - use proper server-side pagination
      return await this.merchandiseService.getMerchandiseList(this.buildBaseFilter(subId, false));
    } else if (cat && this.subcategories().length > 0) {
      // Parent category with subcategories - use includeChildren to get all items from category tree
      const filter = { ...this.buildBaseFilter(undefined, true), categoryId: cat._id };
      return await this.merchandiseService.getMerchandiseList(filter);
    } else if (cat) {
      // Parent category without subcategories
      return await this.merchandiseService.getMerchandiseList(this.buildBaseFilter(cat._id, false));
    } else {
      // All items (no category filter)
      return await this.merchandiseService.getMerchandiseList(this.buildBaseFilter(undefined, false));
    }
  }

  private buildBaseFilter(categoryId?: string, includeChildren?: boolean): MerchandiseListFilter {
    const filter: MerchandiseListFilter = {
      page: this.pagination().page,
      limit: this.pagination().limit,
      sortBy: this.sortBy() as MerchandiseListFilter['sortBy'],
      sortOrder: this.sortOrder(),
    };

    if (categoryId) filter.categoryId = categoryId;
    if (includeChildren) filter.includeChildren = includeChildren;

    if (this.searchQuery()) filter.search = this.searchQuery();
    if (this.filterIsActive() !== null) filter.isActive = this.filterIsActive()!;

    const stockF = this.selectedStockFilter();
    if (stockF === 'inStock') filter.inStock = true;
    if (stockF === 'outOfStock') filter.outOfStock = true;

    if (this.filterMinPrice() !== null) filter.minPrice = this.filterMinPrice()!;
    if (this.filterMaxPrice() !== null) filter.maxPrice = this.filterMaxPrice()!;

    return filter;
  }

  // ── Tab change ────────────────────────────────────────────────────────────

  protected async onTabChange(index: number): Promise<void> {
    this.activeTabIndex.set(index);
    this.selectedSubcategoryId.set(null);
    this.pagination.update((p) => ({ ...p, page: 1 }));

    // Build subcategory dropdown for the selected root category
    const cat = this.activeCategory();
    if (cat) {
      const children = this.categories().filter(
        (c) => c.parentId === cat._id && c.isActive
      );
      this.subcategories.set(
        children.map((c) => ({ label: c.name, value: c._id }))
      );
    } else {
      this.subcategories.set([]);
    }

    await this.loadMerchandise();
  }

  protected async onSubcategoryChange(value: string): Promise<void> {
    // empty string = "All subcategories" sentinel
    this.selectedSubcategoryId.set(value || null);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  // ── Filter / sort change ──────────────────────────────────────────────────

  protected async onSearchChange(query: string): Promise<void> {
    this.searchQuery.set(query);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async onSortChange(value: string): Promise<void> {
    this.selectedSort.set(value);
    const [field, order] = value.split('_');
    this.sortBy.set(field);
    this.sortOrder.set(order as 'asc' | 'desc');
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async onActiveFilterChange(value: boolean | null): Promise<void> {
    this.filterIsActive.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async onStockFilterChange(value: string | null): Promise<void> {
    this.selectedStockFilter.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async onMinPriceChange(value: number | null): Promise<void> {
    this.filterMinPrice.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async onMaxPriceChange(value: number | null): Promise<void> {
    this.filterMaxPrice.set(value);
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async clearFilters(): Promise<void> {
    this.searchQuery.set('');
    this.filterIsActive.set(null);
    this.filterInStock.set(null);
    this.filterMinPrice.set(null);
    this.filterMaxPrice.set(null);
    this.selectedStockFilter.set(null);
    this.selectedSort.set('createdAt_desc');
    this.sortBy.set('createdAt');
    this.sortOrder.set('desc');
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  // ── Pagination ────────────────────────────────────────────────────────────

  protected async onPageChange(event: { first: number; rows: number }): Promise<void> {
    const page = Math.floor(event.first / event.rows) + 1;
    const limit = event.rows;
    this.pagination.update((p) => ({ ...p, page, limit }));
    await this.loadMerchandise();
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  protected openMerchandiseDetails(id: string): void {
    this.detailsMerchandiseId.set(id);
    this.showDetailsDialog.set(true);
  }

  protected openNew(): void {
    this.dialogMode.set('new');
    this.selectedMerchandise.set(null);
    this.showDialog.set(true);
  }

  protected openEdit(item: Merchandise): void {
    this.dialogMode.set('edit');
    this.selectedMerchandise.set(item);
    this.showDialog.set(true);
  }

  protected async onMerchandiseSaved(): Promise<void> {
    this.pagination.update((p) => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected confirmDelete(item: Merchandise): void {
    this.confirmationService.confirm({
      message: `Видалити товар "${item.name}"?`,
      header: 'Підтвердження видалення',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Видалити',
      rejectLabel: 'Скасувати',
      acceptButtonStyleClass: 'p-button-danger',
      accept: async () => {
        try {
          await this.merchandiseService.deleteMerchandise(item._id);
          this.messageService.add({ severity: 'success', summary: 'Видалено', detail: `"${item.name}" видалено` });
          await this.loadMerchandise();
        } catch {
          this.messageService.add({ severity: 'error', summary: 'Помилка', detail: 'Не вдалося видалити товар' });
        }
        this.cdr.markForCheck();
      },
    });
  }

  // ── Template helpers ──────────────────────────────────────────────────────

  protected getStockSeverity(qty: number): 'success' | 'warning' | 'danger' {
    if (qty > 10) return 'success';
    if (qty > 0) return 'warning';
    return 'danger';
  }

  protected getStockLabel(qty: number): string {
    if (qty > 10) return 'В наявності';
    if (qty > 0) return 'Мало';
    return 'Немає';
  }

  protected getCategoryName(categoryId: string): string {
    return this.categories().find((c) => c._id === categoryId)?.name ?? '—';
  }

  protected getFirstImage(item: Merchandise): string {
    return item.images?.[0] ?? '';
  }

  protected formatPrice(price: number, currency: string): string {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(price);
  }

  // ── Stock editing methods ─────────────────────────────────────────────────

  protected getStockDisplayValue(item: Merchandise): number {
    const edit = this.stockEdits().get(item._id);
    return edit ? edit.newValue : item.stockQuantity;
  }

  protected isStockDirty(id: string): boolean {
    const edit = this.stockEdits().get(id);
    return edit ? edit.originalValue !== edit.newValue : false;
  }

  protected updateStockEdit(id: string, originalValue: number, newValue: number): void {
    const map = new Map(this.stockEdits());
    if (originalValue === newValue) {
      map.delete(id);
    } else {
      const existing = map.get(id);
      map.set(id, {
        originalValue: existing?.originalValue ?? originalValue,
        newValue,
      });
    }
    this.stockEdits.set(map);
    this.cdr.markForCheck();
  }

  protected onStockInputChange(item: Merchandise, value: number | null): void {
    if (value === null || value < 0) return;
    this.updateStockEdit(item._id, item.stockQuantity, Math.floor(value));
  }

  protected incrementStock(item: Merchandise): void {
    const current = this.getStockDisplayValue(item);
    this.updateStockEdit(item._id, item.stockQuantity, current + 1);
  }

  protected decrementStock(item: Merchandise): void {
    const current = this.getStockDisplayValue(item);
    if (current <= 0) return;
    this.updateStockEdit(item._id, item.stockQuantity, current - 1);
  }

  protected revertStock(item: Merchandise): void {
    const map = new Map(this.stockEdits());
    map.delete(item._id);
    this.stockEdits.set(map);
    this.cdr.markForCheck();
  }

  protected async submitStock(item: Merchandise): Promise<void> {
    const edit = this.stockEdits().get(item._id);
    if (!edit) return;

    const submitting = new Set(this.submittingStock());
    submitting.add(item._id);
    this.submittingStock.set(submitting);
    this.cdr.markForCheck();

    try {
      await this.merchandiseService.updateMerchandise(item._id, {
        stockQuantity: edit.newValue,
      });
      const map = new Map(this.stockEdits());
      map.delete(item._id);
      this.stockEdits.set(map);

      const updatedList = this.merchandise().map((m) =>
        m._id === item._id ? { ...m, stockQuantity: edit.newValue } : m
      );
      this.merchandise.set(updatedList);

      this.messageService.add({
        severity: 'success',
        summary: 'Успішно',
        detail: `Наявність "${item.name}" оновлено: ${edit.newValue} шт.`,
      });
    } catch {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: 'Не вдалося оновити наявність',
      });
    } finally {
      const submitting = new Set(this.submittingStock());
      submitting.delete(item._id);
      this.submittingStock.set(submitting);
      this.cdr.markForCheck();
    }
  }
}
