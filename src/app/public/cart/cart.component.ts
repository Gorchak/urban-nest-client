import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartItem } from '../../core/models/cart.model';
import { CartService } from '../../core/services/cart.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
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
  protected formatPrice(value: number, currency = 'UAH'): string {
    return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  }
}
