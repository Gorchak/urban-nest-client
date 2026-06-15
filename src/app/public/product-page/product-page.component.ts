import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { Category, CategorySpecification } from '../../core/models/category.model';
import { InventoryAttributeQuantity, Merchandise, MerchandiseSpecification } from '../../core/models/merchandise.model';
import { CategoriesService } from '../../core/services/categories.service';
import { MerchandiseService } from '../../core/services/merchandise.service';
import { PublicHeaderComponent } from '../shared/public-header.component';
import { PublicProductCardComponent } from '../shared/public-product-card.component';
import { RecentlyViewedService } from '../services/recently-viewed.service';
import { CartService } from '../../core/services/cart.service';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [CommonModule, RouterLink, PublicHeaderComponent, PublicProductCardComponent],
  templateUrl: './product-page.component.html',
  styleUrl: './product-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private merchandiseService = inject(MerchandiseService);
  private categoriesService = inject(CategoriesService);
  private recentlyViewedService = inject(RecentlyViewedService);
  private cartService = inject(CartService);
  private cdr = inject(ChangeDetectorRef);
  private routeSubscription?: Subscription;

  protected product = signal<Merchandise | null>(null);
  protected category = signal<Category | null>(null);
  protected allProducts = signal<Merchandise[]>([]);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected activeImage = signal(0);
  protected selectedVariant = signal<string | null>(null);
  protected addingToCart = signal(false);

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
  ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.activeImage.set(0);
    this.selectedVariant.set(null);
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
      const firstAvailable = product.inventory?.attribute_quantities?.find((row) => row.quantity > 0);
      this.selectedVariant.set(firstAvailable?.value_key ?? null);
      this.recentlyViewedService.add(product);
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
      });
    } finally {
      this.addingToCart.set(false);
    }
  }
  protected formatPrice(product: Merchandise): string {
    return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: product.currency, maximumFractionDigits: 0 }).format(product.salePrice);
  }
  protected optimizedUrl(url: string, width = 1000): string {
    return url.includes('res.cloudinary.com') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`) : url;
  }
  protected specificationLabel(spec: MerchandiseSpecification, definition?: CategorySpecification): string {
    return definition?.name || spec.slug;
  }
  protected specificationValue(spec: MerchandiseSpecification, definition?: CategorySpecification): string {
    const value = spec.value;
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => definition?.options?.find((option) => option.value === String(item))?.label ?? String(item)).join(', ');
  }
}
