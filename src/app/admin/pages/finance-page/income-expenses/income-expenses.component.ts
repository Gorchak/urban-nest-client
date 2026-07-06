import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToastModule } from 'primeng/toast';
import { ExpenseFilter, FinanceFilter } from '../../../../core/models/finance.model';
import { FinanceService } from '../../../../core/services/finance.service';

type MonthPreset = 'current' | 'previous' | 'all' | null;

interface FinanceTableRow {
  type: string;
  expenses: number;
  income: number | null;
}

@Component({
  selector: 'app-income-expenses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    CalendarModule,
    CardModule,
    CheckboxModule,
    ProgressSpinnerModule,
    ToastModule,
  ],
  templateUrl: './income-expenses.component.html',
  styleUrls: ['./income-expenses.component.scss'],
})
export class IncomeExpensesComponent implements OnInit {
  private financeService = inject(FinanceService);
  private messageService = inject(MessageService);
  private readonly batchSize = 50;

  protected dateRange = signal<(Date | null)[] | null>(null);
  protected selectedPreset = signal<MonthPreset>('current');
  protected loading = signal(false);
  protected expensesTotal = signal(0);
  protected incomeTotal = signal(0);
  protected productExpensesTotal = signal(0);
  protected auxiliaryExpensesTotal = signal(0);
  protected expenseItemsCount = signal(0);
  protected incomeItemsCount = signal(0);
  protected auxiliaryExpenseItemsCount = signal(0);
  protected tableRows = signal<FinanceTableRow[]>([]);
  protected loadedRecords = signal(0);
  protected totalRecords = signal(0);

  protected profit = computed(() => this.incomeTotal() - this.expensesTotal());
  protected progressLabel = computed(() => {
    const total = this.totalRecords();
    if (!this.loading() || total === 0) return '';
    return `${this.loadedRecords()} / ${total}`;
  });

  async ngOnInit(): Promise<void> {
    this.applyPreset('current');
  }

  protected async onDateRangeChange(value: (Date | null)[] | null): Promise<void> {
    this.dateRange.set(value);
    this.selectedPreset.set(null);
    if (this.hasCompleteRange(value)) {
      await this.loadFinanceData();
    }
  }

  protected applyPreset(preset: Exclude<MonthPreset, null>): void {
    this.selectedPreset.set(preset);
    this.dateRange.set(preset === 'all' ? null : this.getMonthRange(preset));
    void this.loadFinanceData();
  }

  protected async refresh(): Promise<void> {
    await this.loadFinanceData();
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      maximumFractionDigits: 0,
    }).format(value);
  }

  private async loadFinanceData(): Promise<void> {
    const filter = this.buildFilter();
    this.loading.set(true);
    this.expensesTotal.set(0);
    this.incomeTotal.set(0);
    this.productExpensesTotal.set(0);
    this.auxiliaryExpensesTotal.set(0);
    this.expenseItemsCount.set(0);
    this.incomeItemsCount.set(0);
    this.auxiliaryExpenseItemsCount.set(0);
    this.tableRows.set([]);
    this.loadedRecords.set(0);
    this.totalRecords.set(0);

    try {
      const [productExpenses, incomes, auxiliaryExpenses] = await Promise.all([
        this.loadAllProductExpenses(filter),
        this.loadAllIncomes(filter),
        this.loadAllAuxiliaryExpenses(filter),
      ]);

      const totalExpenses = productExpenses.total + auxiliaryExpenses.total;
      this.productExpensesTotal.set(productExpenses.total);
      this.auxiliaryExpensesTotal.set(auxiliaryExpenses.total);
      this.expensesTotal.set(totalExpenses);
      this.incomeTotal.set(incomes.total);
      this.expenseItemsCount.set(productExpenses.count);
      this.incomeItemsCount.set(incomes.count);
      this.auxiliaryExpenseItemsCount.set(auxiliaryExpenses.count);
      this.tableRows.set([
        { type: 'Товари', expenses: productExpenses.total, income: incomes.total },
        ...auxiliaryExpenses.rows,
      ]);
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Фінанси',
        detail: err?.error?.message || 'Не вдалося отримати фінансові дані',
      });
    } finally {
      this.loading.set(false);
    }
  }

  private async loadAllProductExpenses(filter: FinanceFilter): Promise<{ total: number; count: number }> {
    let page = 1;
    let pages = 1;
    let total = 0;
    let count = 0;

    do {
      const batch = await this.financeService.getExpenseBatch({ ...filter, page, limit: this.batchSize });
      total += batch.data.reduce((sum, item) => sum + Number(item.purchasePrice || 0), 0);
      count += batch.data.length;
      pages = batch.pagination.pages || 1;
      this.trackProgress(batch.pagination.total, batch.data.length, page);
      page += 1;
    } while (page <= pages);

    return { total, count };
  }

  private async loadAllIncomes(filter: FinanceFilter): Promise<{ total: number; count: number }> {
    let page = 1;
    let pages = 1;
    let total = 0;
    let count = 0;

    do {
      const batch = await this.financeService.getIncomeBatch({ ...filter, page, limit: this.batchSize });
      total += batch.data.reduce((sum, item) => sum + Number(item.grandTotal || 0), 0);
      count += batch.data.length;
      pages = batch.pagination.pages || 1;
      this.trackProgress(batch.pagination.total, batch.data.length, page);
      page += 1;
    } while (page <= pages);

    return { total, count };
  }

  private async loadAllAuxiliaryExpenses(filter: FinanceFilter): Promise<{ total: number; count: number; rows: FinanceTableRow[] }> {
    let page = 1;
    let pages = 1;
    let total = 0;
    let count = 0;
    const byType = new Map<string, number>();
    const expenseFilter = this.toExpenseFilter(filter);

    do {
      const batch = await this.financeService.getExpenses({ ...expenseFilter, page, limit: 100 });
      total += batch.data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      count += batch.data.length;
      for (const item of batch.data) {
        const type = item.type || 'Інші витрати';
        byType.set(type, (byType.get(type) || 0) + Number(item.amount || 0));
      }
      pages = batch.pagination.pages || 1;
      this.trackProgress(batch.pagination.total, batch.data.length, page);
      page += 1;
    } while (page <= pages);

    const rows = [...byType.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'uk'))
      .map(([type, expenses]) => ({ type, expenses, income: null }));

    return { total, count, rows };
  }

  private trackProgress(total: number, loaded: number, page: number): void {
    if (page === 1) {
      this.totalRecords.update((current) => current + total);
    }
    this.loadedRecords.update((current) => current + loaded);
  }

  private buildFilter(): FinanceFilter {
    if (this.selectedPreset() === 'all') return {};

    const range = this.dateRange();
    if (!this.hasCompleteRange(range)) return {};

    return {
      fromDate: this.startOfDay(range[0]).toISOString(),
      toDate: this.endOfDay(range[1]).toISOString(),
    };
  }

  private toExpenseFilter(filter: FinanceFilter): ExpenseFilter {
    return {
      fromDate: filter.fromDate,
      toDate: filter.toDate,
    };
  }

  private hasCompleteRange(value: (Date | null)[] | null): value is [Date, Date] {
    return Array.isArray(value) && value[0] instanceof Date && value[1] instanceof Date;
  }

  private getMonthRange(preset: Exclude<MonthPreset, 'all' | null>): [Date, Date] {
    const now = new Date();
    const year = now.getFullYear();
    const month = preset === 'current' ? now.getMonth() : now.getMonth() - 1;
    return [
      new Date(year, month, 1),
      new Date(year, month + 1, 0),
    ];
  }

  private startOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(0, 0, 0, 0);
    return value;
  }

  private endOfDay(date: Date): Date {
    const value = new Date(date);
    value.setHours(23, 59, 59, 999);
    return value;
  }
}
