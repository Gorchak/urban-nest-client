import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Category, CategorySpecification } from '../../core/models/category.model';
import { InventoryAttributeQuantity, Merchandise, MerchandiseSpecification, getDiscountedPrice, hasDiscount as merchandiseHasDiscount } from '../../core/models/merchandise.model';
import { CategoriesService } from '../../core/services/categories.service';
import { MerchandiseService } from '../../core/services/merchandise.service';
import { SeoService } from '../../core/services/seo.service';
import { StructuredDataService } from '../../core/services/structured-data.service';
import { PublicProductCardComponent } from '../shared/public-product-card.component';
import { PublicFooterComponent } from '../shared/public-footer.component';
import { RecentlyViewedService } from '../services/recently-viewed.service';
import { CartService } from '../../core/services/cart.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { formatCurrency } from '../../core/utils/price-format';
import { toRouteSlug } from '../../core/utils/route-slug';
import { OneClickOrderDialogComponent } from './one-click-order-dialog.component';
import { OptimizedImageComponent } from '../../shared/components/optimized-image/optimized-image.component';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PublicProductCardComponent, PublicFooterComponent, OneClickOrderDialogComponent, OptimizedImageComponent],
  templateUrl: './product-page.component.html',
  styleUrl: './product-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private merchandiseService = inject(MerchandiseService);
  private categoriesService = inject(CategoriesService);
  private seo = inject(SeoService);
  private structuredData = inject(StructuredDataService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private cartService = inject(CartService);
  private favoritesService = inject(FavoritesService);
  private cdr = inject(ChangeDetectorRef);
  private document = inject(DOCUMENT);
  private routeSubscription?: Subscription;
  private previousBodyOverflow = '';

  protected product = signal<Merchandise | null>(null);
  protected category = signal<Category | null>(null);
  protected allProducts = signal<Merchandise[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected activeImage = signal(0);
  protected selectedVariant = signal<string | null>(null);
  protected addingToCart = signal(false);
  protected favoriteBusy = signal(false);
  protected favoriteNotice = signal<string | null>(null);
  protected showQuickOrder = signal(false);
  protected quickOrderNotice = signal<string | null>(null);
  protected imagePreviewOpen = signal(false);

  protected availableVariants = computed(() =>
    (this.product()?.inventory?.attribute_quantities ?? []).filter((row) => row.quantity > 0),
  );
  protected recentlyViewed = computed(() =>
    this.recentlyViewedService.resolve(this.allProducts(), this.product()?._id).slice(0, 5),
  );
  protected relatedProducts = computed(() => {
    const product = this.product();
    return product
      ? this.allProducts().filter((item) => item._id !== product._id && item.categoryId === product.categoryId && item.isActive && item.isVisible).slice(0, 5)
      : [];
  });
  protected isFavorite = computed(() => {
    const product = this.product();
    return product ? this.favoritesService.has(product._id) : false;
  });
  protected displaySpecifications = computed(() => {
    const product = this.product();
    const category = this.category();
    if (!product) return [];
    const categoryMap = new Map((category?.specifications ?? []).map((spec) => [spec.referenceId, spec]));
    return product.specifications
      .filter((spec) => spec.value !== null && spec.value !== undefined && spec.value !== '')
      .map((spec) => ({ spec, definition: categoryMap.get(spec.referenceId) }));
  });

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(() => void this.load());
  }
  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.restorePageScroll();
  }

  @HostListener('document:keydown.escape')
  protected closeImagePreview(): void {
    this.imagePreviewOpen.set(false);
    this.restorePageScroll();
  }

  protected openImagePreview(): void {
    if (this.product()?.images?.[this.activeImage()]) {
      this.previousBodyOverflow = this.document.body.style.overflow;
      this.document.body.style.overflow = 'hidden';
      this.imagePreviewOpen.set(true);
    }
  }

  private restorePageScroll(): void {
    this.document.body.style.overflow = this.previousBodyOverflow;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.activeImage.set(0);
    this.imagePreviewOpen.set(false);
    this.restorePageScroll();
    this.selectedVariant.set(null);
    this.quickOrderNotice.set(null);
    try {
      const slug = this.route.snapshot.paramMap.get('slug');
      if (!slug) throw new Error('Товар не знайдено');
      const [product, productsResult, categories] = await Promise.all([
        this.merchandiseService.getMerchandiseBySlug(slug),
        this.merchandiseService.getMerchandiseList({ isActive: true, isVisible: true, limit: 100 }),
        this.categoriesService.getCategories(1, 200),
      ]);
      if (!product.isActive || !product.isVisible) throw new Error('Товар не знайдено');
      this.allProducts.set(productsResult.data);
      this.product.set(product);
      this.category.set(categories.find((item) => item._id === product.categoryId) ?? null);
      this.seo.setPage({
        title: product.seoTitle || `${product.name} | Ulia`,
        description: product.seoDescription || product.shortDescription || product.description,
        keywords: product.seoKeywords,
        canonicalUrl: product.canonicalUrl || `/product/${product.slug}`,
        ogImage: product.ogImage || product.images?.[0],
        type: 'product',
      });
      const aggregateRating = product.aggregateRating ? {
        '@type': 'AggregateRating',
        ratingValue: product.aggregateRating.ratingValue,
        reviewCount: product.aggregateRating.reviewCount,
        bestRating: product.aggregateRating.bestRating || 5,
        worstRating: product.aggregateRating.worstRating || 1,
      } : undefined;
      const review = product.review ? {
        '@type': 'Review',
        author: { '@type': 'Person', name: product.review.author },
        reviewBody: product.review.reviewBody,
        ...(product.review.datePublished ? { datePublished: product.review.datePublished } : {}),
        reviewRating: {
          '@type': 'Rating',
          ratingValue: product.review.ratingValue,
          bestRating: 5,
          worstRating: 1,
        },
      } : undefined;
      this.structuredData.set('product', {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.seoDescription || product.shortDescription || product.description || product.name,
        sku: product.sku,
        image: product.images || [],
        ...(aggregateRating ? { aggregateRating } : {}),
        ...(review ? { review } : {}),
        offers: {
          '@type': 'Offer',
          price: this.finalPrice(product),
          priceCurrency: product.currency,
          availability: (product.inventory?.total_quantity ?? 0) > 0
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: product.canonicalUrl || `/product/${product.slug}`,
        },
      });
      const firstAvailable = product.inventory?.attribute_quantities?.find((row) => row.quantity > 0);
      this.selectedVariant.set(firstAvailable?.value_key ?? null);
      this.recentlyViewedService.add(product);
      void this.loadFavorites();
    } catch (error: any) {
      this.error.set(error?.message ?? 'Не вдалося завантажити товар');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected selectVariant(variant: InventoryAttributeQuantity): void { this.selectedVariant.set(variant.value_key); }
  protected async addToCart(): Promise<void> {
    const product = this.product();
    if (!product) return;
    const variant = product.inventory.attribute_quantities.find((row) => row.value_key === this.selectedVariant());
    this.addingToCart.set(true);
    try {
      await this.cartService.addItem({
        merchandiseId: product._id,
        inventoryValueKey: variant?.value_key ?? null,
        inventoryValueLabel: variant?.value_label ?? null,
        quantity: 1,
      }, product);
    } finally {
      this.addingToCart.set(false);
    }
  }
  protected openQuickOrder(): void {
    this.quickOrderNotice.set(null);
    this.showQuickOrder.set(true);
  }
  protected onQuickOrderCreated(): void {
    this.quickOrderNotice.set('Дякуємо! Ми отримали Ваше замовлення і скоро звʼяжемося з Вами.');
    this.cdr.markForCheck();
  }
  protected async toggleFavorite(): Promise<void> {
    const product = this.product();
    if (!product || this.favoriteBusy()) return;

    this.favoriteBusy.set(true);
    this.favoriteNotice.set(null);
    try {
      if (!(await this.favoritesService.isAuthenticated())) {
        this.favoritesService.login(`/product/${product.slug}`);
        return;
      }

      if (this.isFavorite()) {
        await this.favoritesService.remove(product._id);
        this.favoriteNotice.set('Товар видалено з вибраного');
      } else {
        await this.favoritesService.add(product._id);
        this.favoriteNotice.set('Товар додано у вибране');
      }
    } catch (error: any) {
      this.favoriteNotice.set(error?.error?.message || 'Не вдалося оновити вибране');
    } finally {
      this.favoriteBusy.set(false);
      this.cdr.markForCheck();
    }
  }
  protected hasDiscount(product: Merchandise): boolean { return merchandiseHasDiscount(product); }
  protected finalPrice(product: Merchandise): number { return getDiscountedPrice(product); }
  protected formatPrice(product: Merchandise, value = getDiscountedPrice(product)): string {
    return formatCurrency(value, product.currency);
  }
  protected routeSlug(category: Category): string {
    return toRouteSlug(category.slug);
  }
  protected specificationLabel(spec: MerchandiseSpecification, definition?: CategorySpecification): string {
    return definition?.name || spec.slug;
  }
  protected specificationValue(spec: MerchandiseSpecification, definition?: CategorySpecification): string {
    const value = spec.value;
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => definition?.options?.find((option) => option.value === String(item))?.label ?? String(item)).join(', ');
  }
  protected isBrandSpecification(spec: MerchandiseSpecification, definition?: CategorySpecification): boolean {
    const identifiers = [spec.slug, definition?.slug, definition?.name]
      .filter(Boolean)
      .map((value) => String(value).trim().toLocaleLowerCase('uk-UA'));
    return identifiers.some((value) => ['brand', 'brend', 'бренд'].includes(value));
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
