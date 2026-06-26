import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Merchandise, MerchandiseListFilter, MerchandisePagination } from '../../core/models/merchandise.model';
import { MerchandiseService } from '../../core/services/merchandise.service';
import { SeoService } from '../../core/services/seo.service';
import { PublicFooterComponent } from '../shared/public-footer.component';
import { PublicProductCardComponent } from '../shared/public-product-card.component';

@Component({
  selector: 'app-new-arrivals-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PublicFooterComponent, PublicProductCardComponent],
  templateUrl: './new-arrivals-page.component.html',
  styleUrl: './new-arrivals-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewArrivalsPageComponent implements OnInit {
  private merchandiseService = inject(MerchandiseService);
  private seo = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);

  protected products = signal<Merchandise[]>([]);
  protected pagination = signal<MerchandisePagination>({ total: 0, page: 1, limit: 20, pages: 0 });
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected search = signal('');
  protected sort = signal('createdAt_desc');
  protected inStockOnly = signal(false);

  ngOnInit(): void {
    this.seo.setPage({
      title: 'New arrivals | Ulia',
      description: 'Fresh arrivals in the Ulia catalog.',
      canonicalUrl: '/new-arrivals',
      ogImage: '/assets/logo.png',
    });
    void this.load();
  }

  protected async load(page = 1): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [sortBy, sortOrder] = this.sort().split('_');
      const filter: MerchandiseListFilter = {
        isNewArrival: true,
        isActive: true,
        isVisible: true,
        inStock: this.inStockOnly() || undefined,
        search: this.search() || undefined,
        sortBy: sortBy as MerchandiseListFilter['sortBy'],
        sortOrder: sortOrder as 'asc' | 'desc',
        page,
        limit: 20,
      };
      const result = await this.merchandiseService.getMerchandiseList(filter);
      this.products.set(result.data);
      this.pagination.set(result.pagination);
    } catch (error: any) {
      this.error.set(error?.message || 'Не вдалося завантажити новинки.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected pageNumbers(): number[] {
    return Array.from({ length: this.pagination().pages }, (_, index) => index + 1);
  }
}
