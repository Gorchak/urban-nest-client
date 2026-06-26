import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartItem } from '../../core/models/cart.model';
import { CartService } from '../../core/services/cart.service';
import { Merchandise, hasDiscount } from '../../core/models/merchandise.model';
import { formatCurrency } from '../../core/utils/price-format';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
  styles: [`
    .discount-line { margin-top: .65rem; display: flex; align-items: center; gap: .5rem; font-size: 10px; }
    .discount-line del { opacity: .55; }
    .discount-line span { padding: .2rem .35rem; background: #c85436; color: #fff; font-weight: 700; opacity: 1; }
    .discount-line + strong { margin-top: .35rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  protected cartService = inject(CartService);
  protected oneClickOpen = signal(false);
  protected phone = signal('');

  protected close(): void { this.cartService.isOpen.set(false); }
  protected key(item: CartItem): string { return this.cartService.key(item.merchandiseId, item.inventoryValueKey); }
  protected async changeQuantity(item: CartItem, quantity: number): Promise<void> {
    await this.cartService.updateItem(this.key(item), Math.max(1, quantity));
  }
  protected async remove(item: CartItem): Promise<void> { await this.cartService.removeItem(this.key(item)); }
  protected hasDiscount(product: Merchandise | null | undefined): boolean { return product ? hasDiscount(product) : false; }
  protected formatPrice(value: number, currency = 'UAH'): string {
    return formatCurrency(value, currency);
  }
}
