import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  FinanceBatch,
  ApplyRecurringExpensesResponse,
  Expense,
  ExpenseDto,
  ExpenseFilter,
  ExpenseListResponse,
  FinanceExpenseItem,
  FinanceFilter,
  FinanceIncomeItem,
} from '../models/finance.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    totalAmount?: number;
  };
}

@Injectable({ providedIn: 'root' })
export class FinanceService {
  private http = inject(HttpClient);

  private readonly merchandiseUrl = `${environment.apiUrl}/merchandise`;
  private readonly salesUrl = `${environment.apiUrl}/sales`;
  private readonly expensesUrl = `${environment.apiUrl}/expenses`;

  async getExpenseBatch(filter: FinanceFilter): Promise<FinanceBatch<FinanceExpenseItem>> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<FinanceExpenseItem[]>>(
        `${this.merchandiseUrl}/finance/prices`,
        { params: this.toParams(filter) },
      ),
    );

    return {
      data: response.data,
      pagination: response.pagination ?? { total: 0, page: 1, limit: filter.limit ?? 50, pages: 0 },
    };
  }

  async getIncomeBatch(filter: FinanceFilter): Promise<FinanceBatch<FinanceIncomeItem>> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<FinanceIncomeItem[]>>(
        `${this.salesUrl}/finance/totals`,
        { params: this.toParams(filter) },
      ),
    );

    return {
      data: response.data,
      pagination: response.pagination ?? { total: 0, page: 1, limit: filter.limit ?? 50, pages: 0 },
    };
  }

  async getExpenses(filter: ExpenseFilter = {}): Promise<ExpenseListResponse> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<Expense[]>>(this.expensesUrl, { params: this.toParams(filter) }),
    );

    return {
      data: response.data,
      pagination: {
        total: response.pagination?.total ?? 0,
        page: response.pagination?.page ?? 1,
        limit: response.pagination?.limit ?? filter.limit ?? 20,
        pages: response.pagination?.pages ?? 0,
        totalAmount: response.pagination?.totalAmount ?? 0,
      },
    };
  }

  async createExpense(data: ExpenseDto): Promise<Expense> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<Expense>>(this.expensesUrl, data),
    );
    return response.data;
  }

  async updateExpense(id: string, data: ExpenseDto): Promise<Expense> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<Expense>>(`${this.expensesUrl}/${id}`, data),
    );
    return response.data;
  }

  async deleteExpense(id: string): Promise<void> {
    await firstValueFrom(this.http.delete<ApiResponse<null>>(`${this.expensesUrl}/${id}`));
  }

  async applyRecurringExpenses(): Promise<ApplyRecurringExpensesResponse> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<ApplyRecurringExpensesResponse>>(`${this.expensesUrl}/recurring/apply`, {}),
    );
    return response.data;
  }

  private toParams(filter: FinanceFilter | ExpenseFilter): HttpParams {
    let params = new HttpParams();
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    if ('fromMonthKey' in filter && filter.fromMonthKey) params = params.set('fromMonthKey', filter.fromMonthKey);
    if ('toMonthKey' in filter && filter.toMonthKey) params = params.set('toMonthKey', filter.toMonthKey);
    if (filter.page) params = params.set('page', String(filter.page));
    if (filter.limit) params = params.set('limit', String(filter.limit));
    return params;
  }
}
