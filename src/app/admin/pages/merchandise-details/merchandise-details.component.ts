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
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { TooltipModule } from 'primeng/tooltip';
import { BadgeModule } from 'primeng/badge';

import { MerchandiseService } from '../../../core/services/merchandise.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Merchandise, MerchandiseSpecification } from '../../../core/models/merchandise.model';
import { Category } from '../../../core/models/category.model';

// ── Display maps ──────────────────────────────────────────────────────────────

const OWNERSHIP_LABELS: Record<string, string> = {
  owned:       'Власний товар',
  consignment: 'Під реалізацію',
  dropshipping:'Дропшипінг',
  partner:     'Партнерський',
  rental:      'Оренда',
};

const SPEC_TYPE_LABELS: Record<string, string> = {
  string:      'Текст',
  text:        'Багаторядковий текст',
  number:      'Число',
  decimal:     'Десятковий',
  boolean:     'Так/Ні',
  select:      'Список',
  multiselect: 'Мультисписок',
  color:       'Колір',
  date:        'Дата',
  json:        'JSON',
};

/**
 * Read-only merchandise details dialog.
 *
 * Usage:
 *   <app-merchandise-details
 *     [visible]="showDetails"
 *     [merchandiseId]="selectedId"
 *     (visibleChange)="showDetails = $event"
 *   />
 */
@Component({
  selector: 'app-merchandise-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DatePipe],
  imports: [
    CommonModule,
    DialogModule,
    ButtonModule,
    TagModule,
    SkeletonModule,
    DividerModule,
    TooltipModule,
    BadgeModule,
  ],
  templateUrl: './merchandise-details.component.html',
  styleUrls: ['./merchandise-details.component.scss'],
})
export class MerchandiseDetailsComponent implements OnChanges {
  private merchandiseService = inject(MerchandiseService);
  private categoriesService  = inject(CategoriesService);
  private datePipe           = inject(DatePipe);
  private cdr                = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() merchandiseId: string | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();

  // ── State ─────────────────────────────────────────────────────────────────

  protected merchandise  = signal<Merchandise | null>(null);
  protected loading      = signal(false);
  protected error        = signal<string | null>(null);
  protected activeImageIdx = signal(0);
  protected categories   = signal<Category[]>([]);

  // ── Computed ──────────────────────────────────────────────────────────────

  protected category = computed(() => {
    const m = this.merchandise();
    return m ? (this.categories().find(c => c._id === m.categoryId) ?? null) : null;
  });

  protected images = computed(() => this.merchandise()?.images ?? []);

  protected activeImage = computed(() => {
    const imgs = this.images();
    const idx  = this.activeImageIdx();
    return imgs[idx] ?? null;
  });

  protected margin = computed(() => {
    const m = this.merchandise();
    if (!m || m.purchasePrice <= 0 || m.salePrice <= 0) return null;
    return ((m.salePrice - m.purchasePrice) / m.purchasePrice * 100).toFixed(1);
  });

  /** Non-empty specs only */
  protected visibleSpecs = computed(() =>
    (this.merchandise()?.specifications ?? []).filter(
      s => s.value !== null && s.value !== undefined && s.value !== ''
    )
  );

  protected hasSeo = computed(() => {
    const m = this.merchandise();
    return !!(m?.seoTitle || m?.seoDescription || m?.seoKeywords?.length || m?.canonicalUrl || m?.ogImage);
  });

  protected readonly ownershipLabels = OWNERSHIP_LABELS;
  protected readonly specTypeLabels  = SPEC_TYPE_LABELS;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnChanges(changes: SimpleChanges): void {
    const idChanged       = changes['merchandiseId'];
    const becameVisible   = changes['visible']?.currentValue === true;

    if ((becameVisible || (idChanged && this.visible)) && this.merchandiseId) {
      this.activeImageIdx.set(0);
      this.loadData();
    }

    if (changes['visible']?.currentValue === false) {
      // Reset on close so old data doesn't flash on next open
      this.merchandise.set(null);
      this.error.set(null);
    }
  }

  // ── Data ─────────────────────────────────────────────────────────────────

  protected async loadData(): Promise<void> {
    if (!this.merchandiseId) return;
    this.loading.set(true);
    this.error.set(null);
    this.merchandise.set(null);

    try {
      const [item, cats] = await Promise.all([
        this.merchandiseService.getMerchandiseById(this.merchandiseId),
        this.categories().length
          ? Promise.resolve(this.categories())
          : this.categoriesService.getCategories(1, 200),
      ]);

      this.merchandise.set(item);
      if (!this.categories().length) this.categories.set(cats);
    } catch (err: any) {
      const status = err?.status;
      this.error.set(
        status === 404
          ? 'Товар не знайдено'
          : (err?.error?.message ?? err?.message ?? 'Помилка завантаження')
      );
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  // ── Image gallery ─────────────────────────────────────────────────────────

  protected selectImage(index: number): void {
    this.activeImageIdx.set(index);
  }

  protected optimizedUrl(url: string, width = 600): string {
    if (!url?.includes('res.cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }

  // ── Formatters ────────────────────────────────────────────────────────────

  protected formatPrice(price: number, currency = 'UAH'): string {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(price);
  }

  protected formatDate(raw: string | null | undefined): string {
    if (!raw) return '—';
    return this.datePipe.transform(raw, 'dd.MM.yyyy HH:mm') ?? '—';
  }

  protected formatSpecValue(spec: MerchandiseSpecification): string {
    const v = spec.value;
    if (v === null || v === undefined) return '—';

    switch (spec.type) {
      case 'boolean':
        return v ? 'Так' : 'Ні';
      case 'date':
        return this.datePipe.transform(v as string, 'dd.MM.yyyy') ?? String(v);
      case 'multiselect':
      case 'color':
        return Array.isArray(v) ? v.join(', ') : String(v);
      case 'json':
        try { return JSON.stringify(v, null, 2); } catch { return String(v); }
      default:
        return String(v);
    }
  }

  protected isColorSpec(spec: MerchandiseSpecification): boolean {
    return spec.type === 'color' && Array.isArray(spec.value);
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

  // ── Close ─────────────────────────────────────────────────────────────────

  protected close(): void {
    this.visibleChange.emit(false);
  }
}
