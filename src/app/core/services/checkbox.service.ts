import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MerchandiseListResponse } from '../models/merchandise.model';
import { Merchandise } from '../models/merchandise.model';
import { Sale, SaleListResponse } from '../models/sale.model';

interface ApiResponse<T> {
  data: T;
  pagination?: { total: number; page: number; limit: number; pages: number };
}

export interface CheckboxIntegrationStatus {
  configured: boolean;
  autoFiscalize: boolean;
  missing: string[];
}

export interface CheckboxGoodDetails {
  product: Merchandise;
  raw: Record<string, unknown>;
  leftovers: Array<Record<string, number | null>>;
}

export interface CheckboxGoodEditDto {
  name?: string;
  short_name?: string;
  type?: 'good' | 'service';
  code?: string;
  is_weight?: boolean;
  barcode?: string;
  uktzed?: string;
  price?: number;
  group?: string;
  position?: number;
}

@Injectable({ providedIn: 'root' })
export class CheckboxService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/checkbox`;

  async getStatus(): Promise<CheckboxIntegrationStatus> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<CheckboxIntegrationStatus>>(`${this.apiUrl}/status`),
    );
    return response.data;
  }

  async getGoods(filter: { page?: number; limit?: number; search?: string } = {}): Promise<MerchandiseListResponse> {
    const params = this.listParams(filter);
    const response = await firstValueFrom(
      this.http.get<ApiResponse<MerchandiseListResponse['data']>>(`${this.apiUrl}/goods`, { params }),
    );
    return {
      data: response.data,
      pagination: response.pagination ?? { total: response.data.length, page: 1, limit: 20, pages: 1 },
    };
  }

  async getGood(goodId: string): Promise<CheckboxGoodDetails> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<CheckboxGoodDetails>>(`${this.apiUrl}/goods/${encodeURIComponent(goodId)}`),
    );
    return response.data;
  }

  async updateGood(goodId: string, data: CheckboxGoodEditDto): Promise<CheckboxGoodDetails> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<CheckboxGoodDetails>>(`${this.apiUrl}/goods/${encodeURIComponent(goodId)}`, data),
    );
    return response.data;
  }

  async getReceipts(filter: { page?: number; limit?: number; search?: string } = {}): Promise<SaleListResponse> {
    const params = this.listParams(filter);
    const response = await firstValueFrom(
      this.http.get<ApiResponse<Sale[]>>(`${this.apiUrl}/receipts`, { params }),
    );
    return {
      data: response.data,
      pagination: response.pagination ?? { total: response.data.length, page: 1, limit: 20, pages: 1 },
    };
  }

  async fiscalizeSale(saleId: string): Promise<Sale> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<Sale>>(`${this.apiUrl}/sales/${encodeURIComponent(saleId)}/fiscalize`, {}),
    );
    return response.data;
  }

  private listParams(filter: { page?: number; limit?: number; search?: string }): HttpParams {
    let params = new HttpParams();
    if (filter.page) params = params.set('page', filter.page);
    if (filter.limit) params = params.set('limit', filter.limit);
    if (filter.search) params = params.set('search', filter.search);
    return params;
  }
}
