import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Category } from '../../core/models/category.model';
import { Merchandise, MerchandiseListFilter, MerchandisePagination } from '../../core/models/merchandise.model';
import { CategoriesService } from '../../core/services/categories.service';
import { MerchandiseService } from '../../core/services/merchandise.service';
import { SeoService } from '../../core/services/seo.service';
import { encodeRouteSlug, normalizeRouteSlug, toRouteSlug } from '../../core/utils/route-slug';
import { PublicProductCardComponent } from '../shared/public-product-card.component';
import { PublicFooterComponent } from '../shared/public-footer.component';
import { StructuredDataService } from '../../core/services/structured-data.service';
import { environment } from '../../../environments/environment';

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
  private router = inject(Router);
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private seo = inject(SeoService);
  private cdr = inject(ChangeDetectorRef);
  private structuredData = inject(StructuredDataService);
  private routeSubscription?: Subscription;

  protected category = signal<Category | null>(null);
  protected subcategories = signal<Category[]>([]);
  protected products = signal<Merchandise[]>([]);
  protected pagination = signal<MerchandisePagination>({ total: 0, page: 1, limit: 12, pages: 0 });
  protected loading = signal(true);
  protected catalogLoading = signal(false);
  protected error = signal<string | null>(null);
  protected search = signal('');
  protected sort = signal('createdAt_desc');
  protected inStockOnly = signal(false);
  protected selectedSubcategoryId = signal('');

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(() => void this.load());
  }
  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.structuredData.remove('category-breadcrumbs');
  }

  protected async load(page = 1): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const categories = await this.categoriesService.getCategories(1, 200);
      const rawSlug = this.route.snapshot.paramMap.get('slug');
      const normalizedSlug = normalizeRouteSlug(rawSlug);
      const category = categories.find((item) => normalizeRouteSlug(item.slug) === normalizedSlug && item.isActive && item.isVisible);
      if (!category) throw new Error('Категорію не знайдено');
      const canonicalSlug = toRouteSlug(category.slug);
      if (typeof window !== 'undefined' && rawSlug !== canonicalSlug) {
        void this.router.navigate(['/category', canonicalSlug], { replaceUrl: true });
      }
      if (this.category()?._id !== category._id) this.selectedSubcategoryId.set('');
      this.subcategories.set(
        categories
          .filter((item) => item.parentId === category._id && item.isActive && item.isVisible)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'uk')),
      );
      this.category.set(category);
      this.seo.setPage({
        title: category.seoTitle || `${category.name} | Ulia`,
        description: category.seoDescription || category.shortDescription || category.description,
        keywords: category.seoKeywords,
        canonicalUrl: category.canonicalUrl || `/category/${encodeRouteSlug(category.slug)}`,
        ogImage: category.ogImage || this.categoryImage(category),
      });
      this.structuredData.set('category-breadcrumbs', {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Головна', item: `${environment.siteUrl}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: category.name,
            item: `${environment.siteUrl}/category/${canonicalSlug}`,
          },
        ],
      });
      await this.loadProducts(page, false);
    } catch (error: any) {
      this.error.set(error?.message ?? 'Не вдалося завантажити категорію');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected async onSubcategoryChange(categoryId: string): Promise<void> {
    this.selectedSubcategoryId.set(categoryId);
    await this.loadProducts(1);
  }

  protected async onFiltersChange(page = 1): Promise<void> {
    await this.loadProducts(page);
  }

  protected async loadProducts(page = 1, showCatalogLoading = true): Promise<void> {
    const category = this.category();
    if (!category) return;
    if (showCatalogLoading) this.catalogLoading.set(true);
    try {
      const [sortBy, sortOrder] = this.sort().split('_');
      const categoryId = this.selectedSubcategoryId() || category._id;
      const filter: MerchandiseListFilter = {
        categoryId,
        includeChildren: true,
        isActive: true,
        isVisible: true,
        inStock: this.inStockOnly() || undefined,
        search: this.search() || undefined,
        sortBy: sortBy as MerchandiseListFilter['sortBy'],
        sortOrder: sortOrder as 'asc' | 'desc',
        page,
        limit: 12,
        view: 'card',
      };
      const result = await this.merchandiseService.getMerchandiseList(filter);
      this.products.set(result.data);
      this.pagination.set(result.pagination);
    } finally {
      if (showCatalogLoading) this.catalogLoading.set(false);
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
    return Array.from({ length: this.pagination().pages ?? 0 }, (_, index) => index + 1);
  }
}
