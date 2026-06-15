import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Category } from '../../core/models/category.model';
import { Merchandise } from '../../core/models/merchandise.model';
import { CategoriesService } from '../../core/services/categories.service';
import { MerchandiseService } from '../../core/services/merchandise.service';
import { PublicProductCardComponent } from '../shared/public-product-card.component';
import { PublicHeaderComponent } from '../shared/public-header.component';
import { PublicFooterComponent } from '../shared/public-footer.component';
import { RecentlyViewedService } from '../services/recently-viewed.service';

interface CategorySection {
  category: Category;
  products: Merchandise[];
}

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicHeaderComponent, PublicProductCardComponent, PublicFooterComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private cdr = inject(ChangeDetectorRef);

  protected categories = signal<Category[]>([]);
  protected merchandise = signal<Merchandise[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected searchQuery = signal('');

  protected visibleCategories = computed(() =>
    this.categories()
      .filter((category) => category.isActive && category.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  protected rootCategories = computed(() =>
    this.visibleCategories().filter((category) => !category.parentId),
  );

  protected sections = computed<CategorySection[]>(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('uk-UA');
    const products = this.merchandise().filter((product) => {
      if (!product.isActive || !product.isVisible) return false;
      if (!query) return true;
      return `${product.name} ${product.shortDescription ?? ''} ${product.sku}`
        .toLocaleLowerCase('uk-UA')
        .includes(query);
    });

    return this.rootCategories()
      .map((category) => {
        const categoryIds = new Set([
          category._id,
          ...this.visibleCategories()
            .filter((candidate) => candidate.parentId === category._id)
            .map((candidate) => candidate._id),
        ]);
        return {
          category,
          products: products.filter((product) => categoryIds.has(product.categoryId)).slice(0, 5),
        };
      })
      .filter((section) => section.products.length > 0);
  });

  protected featuredCategories = computed(() => {
    const withProducts = new Set(this.sections().map((section) => section.category._id));
    return this.rootCategories()
      .filter((category) => withProducts.has(category._id))
      .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder)
      .slice(0, 4);
  });

  protected heroCategory = computed(() =>
    this.featuredCategories().find((category) => this.categoryImage(category)) ?? this.featuredCategories()[0] ?? null,
  );
  protected recentlyViewed = computed(() => this.recentlyViewedService.resolve(this.merchandise()).slice(0, 5));

  async ngOnInit(): Promise<void> {
    try {
      const [categories, merchandiseResult] = await Promise.all([
        this.categoriesService.getCategories(1, 200),
        this.merchandiseService.getMerchandiseList({
          isActive: true,
          isVisible: true,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 100,
        }),
      ]);
      this.categories.set(categories);
      this.merchandise.set(merchandiseResult.data);
    } catch {
      this.error.set('Не вдалося завантажити каталог. Спробуйте оновити сторінку.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
  }

  protected scrollToCategory(category: Category): void {
    document.getElementById(this.sectionId(category))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected sectionId(category: Category): string {
    return `category-${category.slug || category._id}`;
  }

  protected categoryImage(category: Category): string {
    return category.bannerImage || category.coverImage || category.image || category.images?.[0] || '';
  }

  protected productImage(product: Merchandise, index = 0): string {
    return product.images?.[index] ?? '';
  }

  protected optimizedUrl(url: string, width = 900): string {
    if (!url?.includes('res.cloudinary.com')) return url;
    return url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`);
  }

  protected formatPrice(product: Merchandise): string {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: product.currency,
      maximumFractionDigits: 0,
    }).format(product.salePrice);
  }

  protected stockLabel(product: Merchandise): string {
    return (product.inventory?.total_quantity ?? 0) > 0 ? 'В наявності' : 'Під замовлення';
  }
}
