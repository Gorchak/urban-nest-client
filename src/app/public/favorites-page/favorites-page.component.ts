import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FavoritesService } from '../../core/services/favorites.service';
import { Favorite } from '../../core/models/favorite.model';
import { formatCurrency } from '../../core/utils/price-format';
import { getDiscountedPrice } from '../../core/models/merchandise.model';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavoritesPageComponent implements OnInit {
  private favoritesService = inject(FavoritesService);
  private cdr = inject(ChangeDetectorRef);

  protected isAuthenticated = signal(false);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected removingId = signal<string | null>(null);
  protected favorites = this.favoritesService.favorites;

  async ngOnInit(): Promise<void> {
    this.isAuthenticated.set(await this.favoritesService.isAuthenticated());
    if (!this.isAuthenticated()) {
      this.loading.set(false);
      return;
    }

    try {
      await this.favoritesService.load();
    } catch (error: any) {
      this.error.set(error?.error?.message || 'Не вдалося завантажити вибране');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected login(): void {
    this.favoritesService.login('/favorites');
  }

  protected async remove(favorite: Favorite): Promise<void> {
    this.removingId.set(favorite.merchandiseId);
    try {
      await this.favoritesService.remove(favorite.merchandiseId);
    } finally {
      this.removingId.set(null);
      this.cdr.markForCheck();
    }
  }

  protected productName(favorite: Favorite): string {
    return String(favorite.product?.name || 'Товар');
  }

  protected productSlug(favorite: Favorite): string {
    return String(favorite.product?.slug || '');
  }

  protected productSku(favorite: Favorite): string {
    return String(favorite.product?.sku || '');
  }

  protected productImage(favorite: Favorite): string {
    const product: any = favorite.product;
    return product?.images?.[0] || product?.image || '';
  }

  protected productPrice(favorite: Favorite): string {
    const product: any = favorite.product;
    const price = product?.inventory
      ? getDiscountedPrice(product)
      : Math.round((Number(product?.salePrice) || 0) * (1 - Math.max(0, Number(product?.discountPercentage) || 0) / 100) * 100) / 100;
    return formatCurrency(price, product?.currency || 'UAH');
  }

  protected optimizedUrl(url: string, width = 700): string {
    return url.includes('res.cloudinary.com') ? url.replace('/upload/', `/upload/f_auto,q_auto,w_${width}/`) : url;
  }
}

