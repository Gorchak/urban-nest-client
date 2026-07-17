export interface FinancePagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FinanceBatch<T> {
  data: T[];
  pagination: FinancePagination;
}

export interface FinanceFilter {
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface FinanceExpenseItem {
  _id: string;
  purchasePrice: number;
  createdAt: string;
}

export interface FinanceIncomeItem {
  _id: string;
  source?: 'website' | 'checkbox';
  grandTotal: number;
  paymentStatus: 'unpaid' | 'paid' | 'partially_paid' | 'refunded';
  createdAt: string;
  fiscalCode?: string | null;
}

export type ExpenseDateMode = 'exact' | 'month';

export interface Expense {
  _id: string;
  type: string;
  dateMode: ExpenseDateMode;
  expenseDate: string;
  month: number;
  year: number;
  monthKey: string;
  amount: number;
  isRecurring: boolean;
  recurringSourceId: string | null;
  recurringMonthKey: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ExpenseDto {
  type: string;
  dateMode: ExpenseDateMode;
  expenseDate: string;
  month: number;
  year: number;
  amount: number;
  isRecurring: boolean;
}

export interface ExpenseFilter {
  fromDate?: string;
  toDate?: string;
  fromMonthKey?: string;
  toMonthKey?: string;
  page?: number;
  limit?: number;
}

export interface ExpensePagination extends FinancePagination {
  totalAmount: number;
}

export interface ExpenseListResponse {
  data: Expense[];
  pagination: ExpensePagination;
}

export interface ApplyRecurringExpensesResponse {
  created: Expense[];
  monthKey: string;
}
