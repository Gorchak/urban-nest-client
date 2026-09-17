import { ChangeDetectionStrategy, Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartItem } from '../../core/models/cart.model';
import { CartService } from '../../core/services/cart.service';
import { SalesService } from '../../core/services/sales.service';
import { Merchandise, hasDiscount } from '../../core/models/merchandise.model';
import { formatCurrency } from '../../core/utils/price-format';
import { OptimizedImageComponent } from '../../shared/components/optimized-image/optimized-image.component';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, OptimizedImageComponent],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
  styles: [`
    .discount-line { margin-top: .65rem; display: flex; align-items: center; gap: .5rem; font-size: 10px; }
    .discount-line del { opacity: .55; }
    .discount-line span { padding: .2rem .35rem; background: #fff; color: #000; border:1px solid #000; font-weight: 700; opacity: 1; }
    .discount-line + strong { margin-top: .35rem; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartComponent {
  protected cartService = inject(CartService);
  private salesService = inject(SalesService);
  protected oneClickOpen = signal(false);
  protected phone = signal('');
  protected oneClickLoading = signal(false);
  protected oneClickMessage = signal<string | null>(null);
  protected oneClickError = signal<string | null>(null);

  protected close(): void { this.cartService.isOpen.set(false); }
  protected key(item: CartItem): string { return this.cartService.key(item.merchandiseId, item.inventoryValueKey); }
  protected async changeQuantity(item: CartItem, quantity: number): Promise<void> {
    await this.cartService.updateItem(this.key(item), Math.max(1, quantity));
  }
  protected async remove(item: CartItem): Promise<void> { await this.cartService.removeItem(this.key(item)); }
  protected async submitOneClick(): Promise<void> {
    const phone = this.phone().trim();
    if (!phone) {
      this.oneClickError.set('Вкажіть номер телефону');
      return;
    }

    this.oneClickLoading.set(true);
    this.oneClickError.set(null);
    this.oneClickMessage.set(null);
    try {
      await this.cartService.prepareForCheckout();
      await this.salesService.checkout({
        orderNumber: `QO-${Date.now().toString(36).toUpperCase()}`,
        userId: null,
        status: 'processing',
        customer: { firstName: '', lastName: '', middleName: '', phone, email: '' },
        shippingAddress: { country: 'Ukraine', city: '', region: '', street: '', building: '', apartment: '', postalCode: '', deliveryService: '', warehouse: '', trackingNumber: '' },
        payment: { method: 'cash_on_delivery', status: 'unpaid', transactionId: '', paidAt: null },
        items: [],
        subtotal: 0,
        discountTotal: 0,
        shippingCost: 0,
        grandTotal: 0,
        currency: 'UAH',
        notes: 'Швидке замовлення з кошика',
        doNotCall: false,
        inventoryAdjustment: { state: 'none', updatedAt: null },
        guestId: this.cartService.getGuestIdValue(),
        quickOrder: true,
      });
      await this.cartService.handleCheckoutComplete();
      this.oneClickMessage.set('Дякуємо! Менеджер скоро звʼяжеться з Вами.');
      this.phone.set('');
    } catch (err: any) {
      this.oneClickError.set(err?.error?.message || 'Не вдалося створити швидке замовлення');
    } finally {
      this.oneClickLoading.set(false);
    }
  }
  protected hasDiscount(product: Merchandise | null | undefined): boolean { return product ? hasDiscount(product) : false; }
  protected formatPrice(value: number, currency = 'UAH'): string {
    return formatCurrency(value, currency);
  }
}
