import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { FinanceFilter, FinanceIncomeItem } from '../../../../core/models/finance.model';
import { FinanceService } from '../../../../core/services/finance.service';

@Component({
  selector: 'app-checkbox-sales-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, CalendarModule, DialogModule, ProgressSpinnerModule],
  templateUrl: './checkbox-sales-dialog.component.html',
  styleUrls: ['./checkbox-sales-dialog.component.scss'],
})
export class CheckboxSalesDialogComponent implements OnChanges {
  private financeService = inject(FinanceService);
  private readonly pageSize = 50;
  private requestVersion = 0;
  private nextPage = 1;

  @Input() visible = false;
  @Input() initialFilter: FinanceFilter = {};
  @Output() visibleChange = new EventEmitter<boolean>();

  protected sales = signal<FinanceIncomeItem[]>([]);
  protected dateRange = signal<(Date | null)[] | null>(null);
  protected allTime = signal(false);
  protected loading = signal(false);
  protected hasMore = signal(true);
  protected error = signal<string | null>(null);
  protected totalCount = signal(0);
  protected loadedTotal = computed(() => this.sales().reduce((sum, sale) => sum + Number(sale.grandTotal || 0), 0));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && this.visible) {
      this.applyInitialFilter();
      void this.reload();
    }
  }

  protected close(): void {
    this.visibleChange.emit(false);
  }

  protected async onDateRangeChange(value: (Date | null)[] | null): Promise<void> {
    this.dateRange.set(value);
    this.allTime.set(false);
    if (Array.isArray(value) && value[0] instanceof Date && value[1] instanceof Date) {
      await this.reload();
    }
  }

  protected async showAllTime(): Promise<void> {
    this.dateRange.set(null);
    this.allTime.set(true);
    await this.reload();
  }

  protected async onScroll(event: Event): Promise<void> {
    const element = event.target as HTMLElement;
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 160) {
      await this.loadNextPage();
    }
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private applyInitialFilter(): void {
    if (!this.initialFilter.fromDate) {
      this.allTime.set(true);
      this.dateRange.set(null);
      return;
    }
    this.allTime.set(false);
    this.dateRange.set([
      new Date(this.initialFilter.fromDate),
      new Date(this.initialFilter.toDate || this.initialFilter.fromDate),
    ]);
  }

  private async reload(): Promise<void> {
    this.requestVersion += 1;
    this.nextPage = 1;
    this.sales.set([]);
    this.totalCount.set(0);
    this.hasMore.set(true);
    this.error.set(null);
    this.loading.set(false);
    await this.loadNextPage(this.requestVersion);
  }

  private async loadNextPage(version = this.requestVersion): Promise<void> {
    if (this.loading() || !this.hasMore()) return;
    this.loading.set(true);
    try {
      const page = this.nextPage;
      const batch = await this.financeService.getCheckboxIncomeBatch({
        ...this.buildFilter(),
        page,
        limit: this.pageSize,
      });
      if (version !== this.requestVersion) return;

      const knownIds = new Set(this.sales().map((sale) => sale._id));
      const newItems = batch.data.filter((sale) => !knownIds.has(sale._id));
      this.sales.update((items) => [...items, ...newItems]);
      this.totalCount.set(batch.pagination.total);
      this.nextPage = page + 1;
      this.hasMore.set(batch.data.length > 0 && this.nextPage <= Math.max(1, batch.pagination.pages));
    } catch (err: any) {
      if (version === this.requestVersion) {
        this.error.set(err?.error?.message || 'Не вдалося завантажити продажі Checkbox');
        this.hasMore.set(false);
      }
    } finally {
      if (version === this.requestVersion) this.loading.set(false);
    }
  }

  private buildFilter(): FinanceFilter {
    const range = this.dateRange();
    if (this.allTime() || !Array.isArray(range) || !(range[0] instanceof Date) || !(range[1] instanceof Date)) return {};
    const from = new Date(range[0]);
    const to = new Date(range[1]);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { fromDate: from.toISOString(), toDate: to.toISOString() };
  }
}
