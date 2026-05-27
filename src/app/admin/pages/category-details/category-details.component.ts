import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';
import { TabViewModule } from 'primeng/tabview';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { PaginatorModule } from 'primeng/paginator';

import { CategoriesService } from '../../../core/services/categories.service';
import { MerchandiseService } from '../../../core/services/merchandise.service';
import { Category } from '../../../core/models/category.model';
import { Merchandise, MerchandisePagination } from '../../../core/models/merchandise.model';
import { MerchandiseDetailsComponent } from '../merchandise-details/merchandise-details.component';

// ── Display maps ──────────────────────────────────────────────────────────────

const SPEC_TYPE_LABELS: Record<string, string> = {
  string:      'Текст',
  text:        'Текст (довгий)',
  number:      'Число',
  decimal:     'Десятковий',
  boolean:     'Так / Ні',
  select:      'Список',
  multiselect: 'Мультисписок',
  color:       'Колір',
  date:        'Дата',
  json:        'JSON',
};

/**
 * Read-only category details dialog.
 *
 * Usage:
 *   <app-category-details
 *     [visible]="showDetails"
 *     [categoryId]="selectedId"
 *     (visibleChange)="showDetails = $event"
 *   />
 */
@Component({
  selector: 'app-category-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    DividerModule,
    TooltipModule,
    BadgeModule,
    TabViewModule,
    InputTextModule,
    DropdownModule,
    IconFieldModule,
    InputIconModule,
    PaginatorModule,
    MerchandiseDetailsComponent,
  ],
  templateUrl: './category-details.component.html',
  styleUrls: ['./category-details.component.scss'],
})
export class CategoryDetailsComponent implements OnChanges {
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private datePipe           = inject(DatePipe);
  private cdr                = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() categoryId: string | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();

  // ── Category state ────────────────────────────────────────────────────────
  protected category      = signal<Category | null>(null);
  protected loading       = signal(false);
  protected error         = signal<string | null>(null);
  protected activeTabIndex = signal(0);
  protected activeImageIdx = signal(0);

  // ── Products tab state ────────────────────────────────────────────────────
  protected merchandise        = signal<Merchandise[]>([]);
  protected loadingMerchandise = signal(false);
  protected merchandiseLoaded  = signal(false);
  protected merchandisePagination = signal<MerchandisePagination>({
    total: 0, page: 1, limit: 12, pages: 0,
  });
  protected productSearchQuery = signal('');
  protected productSort        = signal('createdAt_desc');
  protected productViewMode    = signal<'grid' | 'list'>('grid');

  // ── Nested merchandise details ────────────────────────────────────────────
  protected showMerchandiseDetails  = signal(false);
  protected detailsMerchandiseId    = signal<string | null>(null);

  // ── Constants ─────────────────────────────────────────────────────────────
  protected readonly specTypeLabels = SPEC_TYPE_LABELS;

  protected readonly sortOptions = [
    { label: 'Нові спочатку',  value: 'createdAt_desc' },
    { label: 'Старі спочатку', value: 'createdAt_asc'  },
    { label: 'Назва А–Я',      value: 'name_asc'       },
    { label: 'Ціна ↑',         value: 'salePrice_asc'  },
    { label: 'Ціна ↓',         value: 'salePrice_desc' },
  ];

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Ordered list of all available images for the hero gallery */
  protected allImages = computed(() => {
    const cat = this.category();
    if (!cat) return [];
    const seen = new Set<string>();
    const push = (url: string | null | undefined): void => {
      if (url && !seen.has(url)) { seen.add(url); }
    };
    push(cat.coverImage);
    push(cat.image);
    push(cat.bannerImage);
    cat.images?.forEach(img => push(img));
    return [...seen];
  });

  protected activeImage = computed(() => {
    const imgs = this.allImages();
    return imgs[this.activeImageIdx()] ?? null;
  });

  protected hasSeo = computed(() => {
    const cat = this.category();
    return !!(
      cat?.seoTitle ||
      cat?.seoDescription ||
      cat?.seoKeywords?.length ||
      cat?.canonicalUrl ||
      cat?.ogImage
    );
  });

  protected hasMedia = computed(() => {
    const cat = this.category();
    return !!(
      cat?.image ||
      cat?.icon  ||
      cat?.coverImage  ||
      cat?.bannerImage ||
      cat?.images?.length
    );
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    const becameVisible = changes['visible']?.currentValue === true;
    const idChanged     = changes['categoryId'];

    if ((becameVisible || (idChanged && this.visible)) && this.categoryId) {
      this.resetState();
      this.loadCategory();
    }

    if (changes['visible']?.currentValue === false) {
      this.category.set(null);
      this.error.set(null);
    }
  }

  private resetState(): void {
    this.activeTabIndex.set(0);
    this.activeImageIdx.set(0);
    this.merchandise.set([]);
    this.merchandiseLoaded.set(false);
    this.productSearchQuery.set('');
    this.productSort.set('createdAt_desc');
    this.merchandisePagination.set({ total: 0, page: 1, limit: 12, pages: 0 });
  }

  // ── Data ──────────────────────────────────────────────────────────────────

  protected async loadCategory(): Promise<void> {
    if (!this.categoryId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const cat = await this.categoriesService.getCategoryById(this.categoryId);
      this.category.set(cat);
    } catch (err: any) {
      const status = err?.status;
      this.error.set(
        status === 404
          ? 'Категорію не знайдено'
          : (err?.error?.message ?? err?.message ?? 'Помилка завантаження'),
      );
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected async loadMerchandise(): Promise<void> {
    if (!this.categoryId) return;
    this.loadingMerchandise.set(true);
    try {
      const [field, order] = this.productSort().split('_');
      const result = await this.merchandiseService.getMerchandiseList({
        categoryId: this.categoryId,
        search:     this.productSearchQuery() || undefined,
        sortBy:     field as any,
        sortOrder:  order as 'asc' | 'desc',
        page:       this.merchandisePagination().page,
        limit:      this.merchandisePagination().limit,
      });
      this.merchandise.set(result.data);
      this.merchandisePagination.set(result.pagination);
      this.merchandiseLoaded.set(true);
    } catch {
      /* silently ignore, empty state covers this */
    } finally {
      this.loadingMerchandise.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Tab / filter handlers ─────────────────────────────────────────────────

  protected onTabChange(index: number): void {
    this.activeTabIndex.set(index);
    if (index === 1 && !this.merchandiseLoaded() && !this.loadingMerchandise()) {
      this.loadMerchandise();
    }
  }

  protected async onProductSearch(query: string): Promise<void> {
    this.productSearchQuery.set(query);
    this.merchandisePagination.update(p => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async onProductSortChange(value: string): Promise<void> {
    this.productSort.set(value);
    this.merchandisePagination.update(p => ({ ...p, page: 1 }));
    await this.loadMerchandise();
  }

  protected async onProductPageChange(event: { first?: number; rows?: number }): Promise<void> {
    const page  = event.first !== undefined && event.rows !== undefined
      ? Math.floor(event.first / event.rows) + 1
      : 1;
    const limit = event.rows ?? 12;
    this.merchandisePagination.update(p => ({ ...p, page, limit }));
    await this.loadMerchandise();
  }

  // ── Gallery ───────────────────────────────────────────────────────────────

  protected selectImage(index: number): void {
    this.activeImageIdx.set(index);
  }

  protected optimizedUrl(url: string, width = 600): string {
    if (!url?.includes('res.cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }

  // ── Merchandise details ───────────────────────────────────────────────────

  protected openMerchandiseDetails(id: string): void {
    this.detailsMerchandiseId.set(id);
    this.showMerchandiseDetails.set(true);
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  protected formatDate(raw: string | null | undefined): string {
    if (!raw) return '—';
    return this.datePipe.transform(raw, 'dd.MM.yyyy HH:mm') ?? '—';
  }

  protected formatPrice(price: number, currency = 'UAH'): string {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(price);
  }

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

  protected getFirstProductImage(item: Merchandise): string {
    return item.images?.[0] ?? '';
  }

  protected getSpecTypeLabel(type?: string): string {
    if (!type) return '—';
    return SPEC_TYPE_LABELS[type] ?? type;
  }

  // ── Close ─────────────────────────────────────────────────────────────────

  protected close(): void {
    this.visibleChange.emit(false);
  }
}
