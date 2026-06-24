import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Category } from '../../core/models/category.model';
import { Merchandise, MerchandiseListFilter, MerchandisePagination } from '../../core/models/merchandise.model';
import { CategoriesService } from '../../core/services/categories.service';
import { MerchandiseService } from '../../core/services/merchandise.service';
import { PublicProductCardComponent } from '../shared/public-product-card.component';
import { PublicFooterComponent } from '../shared/public-footer.component';

@Component({
  selector: 'app-category-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicProductCardComponent, PublicFooterComponent],
  templateUrl: './category-page.component.html',
  styleUrl: './category-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private cdr = inject(ChangeDetectorRef);
  private routeSubscription?: Subscription;

  protected category = signal<Category | null>(null);
  protected products = signal<Merchandise[]>([]);
  protected pagination = signal<MerchandisePagination>({ total: 0, page: 1, limit: 12, pages: 0 });
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected search = signal('');
  protected sort = signal('createdAt_desc');
  protected inStockOnly = signal(false);

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(() => void this.load());
  }
  ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); }

  protected async load(page = 1): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const categories = await this.categoriesService.getCategories(1, 200);
      const slug = this.route.snapshot.paramMap.get('slug');
      const category = categories.find((item) => item.slug === slug && item.isActive && item.isVisible);
      if (!category) throw new Error('Категорію не знайдено');
      this.category.set(category);
      const [sortBy, sortOrder] = this.sort().split('_');
      const filter: MerchandiseListFilter = {
        categoryId: category._id,
        includeChildren: true,
        isActive: true,
        isVisible: true,
        inStock: this.inStockOnly() || undefined,
        search: this.search() || undefined,
        sortBy: sortBy as MerchandiseListFilter['sortBy'],
        sortOrder: sortOrder as 'asc' | 'desc',
        page,
        limit: 12,
      };
      const result = await this.merchandiseService.getMerchandiseList(filter);
      this.products.set(result.data);
      this.pagination.set(result.pagination);
    } catch (error: any) {
      this.error.set(error?.message ?? 'Не вдалося завантажити категорію');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected categoryImage(category: Category): string {
    return category.bannerImage || category.coverImage || category.image || category.images?.[0] || '';
  }
  protected optimizedUrl(url: string): string {
    return url.includes('res.cloudinary.com') ? url.replace('/upload/', '/upload/f_auto,q_auto,w_1800/') : url;
  }
  protected pageNumbers(): number[] {
    return Array.from({ length: this.pagination().pages }, (_, index) => index + 1);
  }
}
