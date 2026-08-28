import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface NovaPoshtaArea {
  Ref: string;
  Description: string;
  AreasCenter?: string;
}

export interface NovaPoshtaCity {
  Ref: string;
  Description: string;
  Area: string;
}

export interface NovaPoshtaWarehouse {
  Ref: string;
  Description: string;
  Number?: string;
  CityRef?: string;
}

@Injectable({ providedIn: 'root' })
export class NovaPoshtaService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/nova-poshta`;

  async getAreas(): Promise<NovaPoshtaArea[]> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<NovaPoshtaArea[]>>(`${this.apiUrl}/areas`),
    );
    return response.data;
  }

  async getCities(areaRef?: string, search?: string, limit = 50): Promise<NovaPoshtaCity[]> {
    let params = new HttpParams();
    if (areaRef) params = params.set('areaRef', areaRef);
    if (search) params = params.set('search', search);
    params = params.set('limit', String(limit));

    const response = await firstValueFrom(
      this.http.get<ApiResponse<NovaPoshtaCity[]>>(`${this.apiUrl}/cities`, { params }),
    );
    return response.data;
  }

  async getWarehouses(cityRef: string, search?: string, limit = 50): Promise<NovaPoshtaWarehouse[]> {
    let params = new HttpParams().set('cityRef', cityRef).set('limit', String(limit));
    if (search) params = params.set('search', search);

    const response = await firstValueFrom(
      this.http.get<ApiResponse<NovaPoshtaWarehouse[]>>(`${this.apiUrl}/warehouses`, { params }),
    );
    return response.data;
  }
}
