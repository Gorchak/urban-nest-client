import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Category } from '../../core/models/category.model';
import { Merchandise } from '../../core/models/merchandise.model';
import { CategoriesService } from '../../core/services/categories.service';
import { MerchandiseService } from '../../core/services/merchandise.service';
import { SeoService } from '../../core/services/seo.service';
import { toRouteSlug } from '../../core/utils/route-slug';
import { PublicProductCardComponent } from '../shared/public-product-card.component';
import { PublicFooterComponent } from '../shared/public-footer.component';
import { RecentlyViewedService } from '../services/recently-viewed.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { Brand } from '../../core/models/brand.model';
import { BrandsService } from '../../core/services/brands.service';
import { StructuredDataService } from '../../core/services/structured-data.service';
import { environment } from '../../../environments/environment';
import { OptimizedImageComponent } from '../../shared/components/optimized-image/optimized-image.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface CategorySection {
  category: Category;
  title: string;
  products: Merchandise[];
}

const HOME_CATEGORY_ORDER = [
  { title: 'Одяг', aliases: ['одяг', 'odyag', 'odiah', 'clothing', 'clothes'] },
  { title: 'Кераміка', aliases: ['кераміка', 'keramika', 'keramica', 'ceramics', 'ceramic'] },
  { title: 'Взуття', aliases: ['взуття', 'vzuttia', 'shoes', 'footwear'] },
  { title: 'Сумки', aliases: ['сумки', 'sumky', 'sumki', 'bags', 'bag'] },
  { title: 'Декор для дому', aliases: ['декор для дому', 'декор', 'dekor dlia domu', 'dekor dlya domu', 'dekor', 'home decor', 'decor'] },
  { title: 'Аксесуари', aliases: ['аксесуари', 'aksesuari', 'aksessuary', 'accessories', 'accessory'] },
];

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, PublicProductCardComponent, PublicFooterComponent, OptimizedImageComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit, OnDestroy {
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private seo = inject(SeoService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private favoritesService = inject(FavoritesService);
  private brandsService = inject(BrandsService);
  private cdr = inject(ChangeDetectorRef);
  private structuredData = inject(StructuredDataService);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);

  protected categories = signal<Category[]>([]);
  protected merchandise = signal<Merchandise[]>([]);
  protected brands = signal<Brand[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected searchQuery = signal('');
  protected searchResults = signal<Merchandise[]>([]);
  protected searchLoading = signal(false);
  protected searchError = signal<string | null>(null);
  private searchTimer?: ReturnType<typeof setTimeout>;
  private searchRequestId = 0;

  protected visibleCategories = computed(() =>
    this.categories()
      .filter((category) => category.isActive && category.isVisible)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  protected filteredProducts = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('uk-UA');
    return this.merchandise().filter((product) => {
      if (!product.isActive || !product.isVisible) return false;
      if (!query) return true;
      return `${product.name} ${product.shortDescription ?? ''} ${product.sku}`
        .toLocaleLowerCase('uk-UA')
        .includes(query);
    });
  });

  protected newArrivals = computed(() =>
    [...this.filteredProducts()]
      .filter((product) => product.isNewArrival)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
  );

  protected sections = computed<CategorySection[]>(() => {
    const categories = this.visibleCategories();
    return HOME_CATEGORY_ORDER
      .map((definition) => {
        const category = categories.find((candidate) => {
          const keys = [candidate.name, candidate.slug].map((value) => this.normalizeCategoryKey(value));
          return definition.aliases.some((alias) => keys.includes(this.normalizeCategoryKey(alias)));
        });
        if (!category) return null;
        const categoryIds = this.categoryTreeIds(category, categories);
        return {
          category,
          title: definition.title,
          products: this.filteredProducts().filter((product) => categoryIds.has(product.categoryId)).slice(0, 5),
        };
      })
      .filter((section): section is CategorySection => Boolean(section?.products.length));
  });

  protected recentlyViewed = computed(() => this.recentlyViewedService.resolve(this.merchandise()).slice(0, 5));
  protected favoriteProducts = computed(() =>
    this.favoritesService.favorites()
      .map((favorite) => favorite.product)
      .filter((product): product is Merchandise => Boolean(product && 'inventory' in product))
      .slice(0, 5),
  );

  async ngOnInit(): Promise<void> {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const query = params.get('search')?.trim() ?? '';
        if (query !== this.searchQuery()) this.onSearchChange(query);
      });
    this.seo.setPage({
      title: 'Ulia — жіночий одяг, взуття, аксесуари та декор',
      description: 'Ulia — онлайн-магазин жіночого одягу, взуття, сумок, аксесуарів, кераміки та декору для дому від українських брендів.',
      canonicalUrl: '/',
      ogImage: '/assets/logo.png',
    });
    try {
      const [categories, newArrivalsResult] = await Promise.all([
        this.categoriesService.getCategories(1, 200),
        this.merchandiseService.getMerchandiseList({
          isActive: true,
          isVisible: true,
          isNewArrival: true,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 5,
          view: 'card',
          includeTotal: false,
        }),
      ]);
      this.categories.set(categories);
      const mainCategories = categories
        .filter((category) => !category.parentId && category.isActive && category.isVisible)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .slice(0, 8);
      this.structuredData.set('website', {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Ulia',
        alternateName: 'Ulia Concept Store',
        url: `${environment.siteUrl}/`,
        inLanguage: 'uk-UA',
      });
      this.structuredData.set('main-navigation', {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Основні категорії Ulia',
        itemListElement: mainCategories.map((category, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: category.name,
          url: `${environment.siteUrl}/category/${toRouteSlug(category.slug)}`,
        })),
      });
      this.merchandise.set(newArrivalsResult.data);
      void this.loadSecondaryContent();
    } catch {
      this.error.set('Не вдалося завантажити каталог. Спробуйте оновити сторінку.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.structuredData.remove('website');
    this.structuredData.remove('main-navigation');
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.searchError.set(null);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    const query = value.trim();
    const requestId = ++this.searchRequestId;
    if (!query) {
      this.searchResults.set([]);
      this.searchLoading.set(false);
      return;
    }
    this.searchLoading.set(true);
    this.searchTimer = setTimeout(() => void this.performSearch(query, requestId), 300);
  }

  protected clearSearch(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchRequestId += 1;
    this.searchQuery.set('');
    this.searchResults.set([]);
    this.searchLoading.set(false);
    this.searchError.set(null);
  }
  protected routeSlug(category: Category): string { return toRouteSlug(category.slug); }

  private normalizeCategoryKey(value: string): string {
    return value.toLocaleLowerCase('uk-UA').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  private categoryTreeIds(root: Category, categories: Category[]): Set<string> {
    const ids = new Set([root._id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories) {
        if (category.parentId && ids.has(category.parentId) && !ids.has(category._id)) {
          ids.add(category._id);
          changed = true;
        }
      }
    }
    return ids;
  }

  private async loadFavorites(): Promise<void> {
    try {
      await this.favoritesService.load();
      this.cdr.markForCheck();
    } catch {
      this.favoritesService.favorites.set([]);
    }
  }

  private async loadSecondaryContent(): Promise<void> {
    try {
      const [catalogResult, brands] = await Promise.all([
        this.merchandiseService.getMerchandiseList({
          isActive: true,
          isVisible: true,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 40,
          view: 'card',
          includeTotal: false,
        }),
        this.brandsService.getBrands({ isActive: true, isVisible: true, limit: 30 }),
      ]);
      const products = new Map(
        [...this.merchandise(), ...catalogResult.data].map((product) => [product._id, product]),
      );
      this.merchandise.set([...products.values()]);
      this.brands.set(brands);
      this.cdr.markForCheck();
      void this.loadFavorites();
    } catch {
      // The critical first screen is already usable; secondary sections can
      // remain absent when a background request fails.
    }
  }

  private async performSearch(query: string, requestId: number): Promise<void> {
    try {
      const result = await this.merchandiseService.getMerchandiseList({
        search: query,
        isActive: true,
        isVisible: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        limit: 24,
        view: 'card',
        includeTotal: false,
      });
      if (requestId !== this.searchRequestId) return;
      this.searchResults.set(result.data);
    } catch {
      if (requestId !== this.searchRequestId) return;
      this.searchResults.set([]);
      this.searchError.set('Не вдалося виконати пошук. Спробуйте ще раз.');
    } finally {
      if (requestId === this.searchRequestId) {
        this.searchLoading.set(false);
        this.cdr.markForCheck();
      }
    }
  }
}
