import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Merchandise } from '../../core/models/merchandise.model';
import { Sale } from '../../core/models/sale.model';
import { SalesService } from '../../core/services/sales.service';

@Component({
  selector: 'app-one-click-order-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './one-click-order-dialog.component.html',
  styleUrl: './one-click-order-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OneClickOrderDialogComponent {
  private salesService = inject(SalesService);
  private cdr = inject(ChangeDetectorRef);

  @Input() visible = false;
  @Input() product: Merchandise | null = null;
  @Input() inventoryValueKey: string | null = null;

  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() ordered = new EventEmitter<Sale>();

  protected phone = signal('');
  protected loading = signal(false);
  protected error = signal<string | null>(null);
  protected success = signal(false);

  @ViewChild('phoneInput') private phoneInput?: ElementRef<HTMLInputElement>;

  protected close(): void {
    if (this.loading()) return;
    this.visibleChange.emit(false);
    this.reset();
  }

  protected async submit(): Promise<void> {
    const product = this.product;
    if (!product || this.loading()) return;

    // iOS can autofill the DOM value without propagating the complete value through ngModel.
    const phone = this.phoneInput?.nativeElement.value ?? this.phone();
    if (!phone.trim()) {
      this.error.set('Вкажіть номер телефону');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    try {
      const sale = await this.salesService.quickOrder({
        phone,
        merchandiseId: product._id,
        inventoryValueKey: this.inventoryValueKey,
      });
      this.success.set(true);
      this.ordered.emit(sale);
    } catch (err: any) {
      this.error.set(err?.error?.message || 'Не вдалося створити швидке замовлення');
    } finally {
      this.loading.set(false);
      this.cdr.markForCheck();
    }
  }

  protected onPhoneInput(event: Event): void {
    this.phone.set((event.target as HTMLInputElement).value);
    this.error.set(null);
  }

  private reset(): void {
    this.phone.set('');
    this.error.set(null);
    this.success.set(false);
  }
}
