import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
  imports: [CommonModule, FormsModule, RouterLink, PublicProductCardComponent, PublicFooterComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent implements OnInit {
  private categoriesService = inject(CategoriesService);
  private merchandiseService = inject(MerchandiseService);
  private seo = inject(SeoService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private favoritesService = inject(FavoritesService);
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
    this.seo.setPage({
      title: 'Ulia',
      description: 'Curated catalog of clothing, ceramics, shoes, bags, home decor and accessories.',
      canonicalUrl: '/',
      ogImage: '/assets/logo.png',
    });
    try {
      const [categories, merchandiseResult, newArrivalsResult] = await Promise.all([
        this.categoriesService.getCategories(1, 200),
        this.merchandiseService.getMerchandiseList({
          isActive: true,
          isVisible: true,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 100,
        }),
        this.merchandiseService.getMerchandiseList({
          isActive: true,
          isVisible: true,
          isNewArrival: true,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 100,
        }),
      ]);
      this.categories.set(categories);
      const products = new Map([...merchandiseResult.data, ...newArrivalsResult.data].map((product) => [product._id, product]));
      this.merchandise.set([...products.values()]);
      void this.loadFavorites();
    } catch {
      this.error.set('Не вдалося завантажити каталог. Спробуйте оновити сторінку.');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected onSearchChange(value: string): void { this.searchQuery.set(value); }
  protected clearSearch(): void { this.searchQuery.set(''); }
  protected sectionId(category: Category): string { return `category-${category.slug || category._id}`; }
  protected routeSlug(category: Category): string { return toRouteSlug(category.slug); }
  protected categoryImage(category: Category): string {
    return category.bannerImage || category.coverImage || category.image || category.images?.[0] || '';
  }
  protected optimizedUrl(url: string, width = 900): string {
    return url?.includes('res.cloudinary.com') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`) : url;
  }

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
}
