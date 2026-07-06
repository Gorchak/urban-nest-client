import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { Expense, ExpenseDateMode, ExpenseDto, ExpenseFilter, ExpensePagination } from '../../../../core/models/finance.model';
import { FinanceService } from '../../../../core/services/finance.service';

interface ExpenseDraft {
  type: string;
  amount: number | null;
  useMonthOnly: boolean;
  exactDate: Date;
  monthDate: Date;
  isRecurring: boolean;
}

const emptyDraft = (): ExpenseDraft => {
  const now = new Date();
  return {
    type: '',
    amount: null,
    useMonthOnly: false,
    exactDate: now,
    monthDate: new Date(now.getFullYear(), now.getMonth(), 1),
    isRecurring: false,
  };
};

type FilterMode = 'date' | 'month';

@Component({
  selector: 'app-expense-accounting',
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
    DialogModule,
    InputNumberModule,
    InputTextModule,
    TableModule,
    TagModule,
    ToastModule,
  ],
  templateUrl: './expense-accounting.component.html',
  styleUrls: ['./expense-accounting.component.scss'],
})
export class ExpenseAccountingComponent implements OnInit {
  private financeService = inject(FinanceService);
  private messageService = inject(MessageService);

  protected expenses = signal<Expense[]>([]);
  protected pagination = signal<ExpensePagination>({ total: 0, page: 1, limit: 20, pages: 0, totalAmount: 0 });
  protected loading = signal(false);
  protected saving = signal(false);
  protected deletingId = signal<string | null>(null);
  protected showDialog = signal(false);
  protected selectedExpense = signal<Expense | null>(null);
  protected draft = signal<ExpenseDraft>(emptyDraft());
  protected filterMode = signal<FilterMode>('month');
  protected filterRange = signal<(Date | null)[] | null>(this.currentMonthRange());
  protected allTime = signal(false);

  protected dialogTitle = computed(() => this.selectedExpense() ? 'Редагувати витрату' : 'Нова допоміжна витрата');

  async ngOnInit(): Promise<void> {
    await this.applyRecurringExpenses();
    await this.loadExpenses();
  }

  protected async loadExpenses(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.financeService.getExpenses({
        ...this.buildFilter(),
        page: this.pagination().page,
        limit: this.pagination().limit,
      });
      this.expenses.set(result.data);
      this.pagination.set(result.pagination);
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Облік витрат',
        detail: err?.error?.message || 'Не вдалося отримати витрати',
      });
    } finally {
      this.loading.set(false);
    }
  }

  protected async onPageChange(event: { first: number; rows: number }): Promise<void> {
    this.pagination.update((value) => ({
      ...value,
      page: Math.floor(event.first / event.rows) + 1,
      limit: event.rows,
    }));
    await this.loadExpenses();
  }

  protected async onFilterModeChange(useMonthFilter: boolean): Promise<void> {
    this.filterMode.set(useMonthFilter ? 'month' : 'date');
    this.allTime.set(false);
    this.filterRange.set(useMonthFilter ? this.currentMonthRange() : null);
    this.pagination.update((value) => ({ ...value, page: 1 }));
    await this.loadExpenses();
  }

  protected async onFilterRangeChange(value: (Date | null)[] | null): Promise<void> {
    this.filterRange.set(value);
    this.allTime.set(false);
    if (!this.hasAnyRangeDate(value)) return;
    this.pagination.update((pagination) => ({ ...pagination, page: 1 }));
    await this.loadExpenses();
  }

  protected async onAllTimeChange(value: boolean): Promise<void> {
    this.allTime.set(value);
    if (value) this.filterRange.set(null);
    this.pagination.update((pagination) => ({ ...pagination, page: 1 }));
    await this.loadExpenses();
  }

  protected openNew(): void {
    this.selectedExpense.set(null);
    this.draft.set(emptyDraft());
    this.showDialog.set(true);
  }

  protected openEdit(expense: Expense): void {
    const expenseDate = new Date(expense.expenseDate);
    this.selectedExpense.set(expense);
    this.draft.set({
      type: expense.type,
      amount: expense.amount,
      useMonthOnly: expense.dateMode === 'month',
      exactDate: expenseDate,
      monthDate: new Date(expense.year, expense.month - 1, 1),
      isRecurring: expense.isRecurring,
    });
    this.showDialog.set(true);
  }

  protected patchDraft(patch: Partial<ExpenseDraft>): void {
    this.draft.update((value) => ({ ...value, ...patch }));
  }

  protected async saveExpense(): Promise<void> {
    const dto = this.toDto(this.draft());
    if (!dto.type || dto.amount <= 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Перевірте поля',
        detail: 'Вкажіть тип витрати та суму більше нуля',
      });
      return;
    }

    this.saving.set(true);
    try {
      const selected = this.selectedExpense();
      if (selected) {
        await this.financeService.updateExpense(selected._id, dto);
      } else {
        await this.financeService.createExpense(dto);
      }

      this.messageService.add({
        severity: 'success',
        summary: 'Збережено',
        detail: selected ? 'Витрату оновлено' : 'Витрату створено',
      });
      this.showDialog.set(false);
      await this.loadExpenses();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: err?.error?.message || 'Не вдалося зберегти витрату',
      });
    } finally {
      this.saving.set(false);
    }
  }

  protected async deleteExpense(expense: Expense): Promise<void> {
    if (!confirm(`Видалити витрату "${expense.type}"?`)) return;

    this.deletingId.set(expense._id);
    try {
      await this.financeService.deleteExpense(expense._id);
      this.messageService.add({ severity: 'success', summary: 'Видалено', detail: 'Витрату видалено' });
      await this.loadExpenses();
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Помилка',
        detail: err?.error?.message || 'Не вдалося видалити витрату',
      });
    } finally {
      this.deletingId.set(null);
    }
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: 'UAH',
      maximumFractionDigits: 0,
    }).format(value);
  }

  protected formatExpenseDate(expense: Expense): string {
    if (expense.dateMode === 'month') {
      return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' })
        .format(new Date(expense.year, expense.month - 1, 1));
    }
    return new Intl.DateTimeFormat('uk-UA').format(new Date(expense.expenseDate));
  }

  private async applyRecurringExpenses(): Promise<void> {
    try {
      const result = await this.financeService.applyRecurringExpenses();
      if (result.created.length) {
        this.messageService.add({
          severity: 'info',
          summary: 'Регулярні витрати',
          detail: `Додано ${result.created.length} витрат(и) за поточний місяць`,
        });
      }
    } catch (err: any) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Регулярні витрати',
        detail: err?.error?.message || 'Не вдалося перевірити регулярні витрати',
      });
    }
  }

  private buildFilter(): ExpenseFilter {
    if (this.allTime()) return {};

    const range = this.filterRange();
    const normalizedRange = this.normalizeRange(range);
    if (!normalizedRange) return {};

    if (this.filterMode() === 'month') {
      return {
        fromMonthKey: this.toMonthKey(normalizedRange[0]),
        toMonthKey: this.toMonthKey(normalizedRange[1]),
      };
    }

    return {
      fromDate: this.startOfDay(normalizedRange[0]).toISOString(),
      toDate: this.endOfDay(normalizedRange[1]).toISOString(),
    };
  }

  private toDto(draft: ExpenseDraft): ExpenseDto {
    const sourceDate = draft.useMonthOnly ? draft.monthDate : draft.exactDate;
    const year = sourceDate.getFullYear();
    const month = sourceDate.getMonth() + 1;
    const dateMode: ExpenseDateMode = draft.useMonthOnly ? 'month' : 'exact';
    const expenseDate = draft.useMonthOnly
      ? new Date(year, month - 1, 1, 12, 0, 0, 0)
      : sourceDate;

    return {
      type: draft.type.trim(),
      dateMode,
      expenseDate: expenseDate.toISOString(),
      month,
      year,
      amount: Number(draft.amount) || 0,
      isRecurring: draft.isRecurring,
    };
  }

  private hasCompleteRange(value: (Date | null)[] | null): value is [Date, Date] {
    return Array.isArray(value) && value[0] instanceof Date && value[1] instanceof Date;
  }

  private hasAnyRangeDate(value: (Date | null)[] | null): boolean {
    return Array.isArray(value) && (value[0] instanceof Date || value[1] instanceof Date);
  }

  private normalizeRange(value: (Date | null)[] | null): [Date, Date] | null {
    if (!Array.isArray(value)) return null;
    const start = value[0] instanceof Date ? value[0] : null;
    const end = value[1] instanceof Date ? value[1] : null;
    if (!start && !end) return null;
    return [start || end!, end || start!];
  }

  private currentMonthRange(): [Date, Date] {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth(), 1)];
  }

  private toMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
