import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, CreateUserDto, UpdateUserDto, UsersListResponse } from '../models/user.model';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  users = signal<User[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  async getUsers(filter: { page?: number; limit?: number; search?: string } = {}): Promise<UsersListResponse> {
    this.loading.set(true);
    this.error.set(null);

    try {
      let params = new HttpParams();
      if (filter.page) params = params.set('page', String(filter.page));
      if (filter.limit) params = params.set('limit', String(filter.limit));
      if (filter.search) params = params.set('search', filter.search);

      const response = await firstValueFrom(
        this.http.get<ApiResponse<User[]>>(this.apiUrl, { params }),
      );
      const result = {
        data: response.data,
        pagination: response.pagination ?? { total: 0, page: 1, limit: 20, pages: 0 },
      };
      this.users.set(result.data);
      return result;
    } catch (err: any) {
      this.error.set(err?.error?.message || err.message || 'Не вдалося отримати користувачів');
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  async updateUser(id: string, data: UpdateUserDto): Promise<User> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<User>>(`${this.apiUrl}/${encodeURIComponent(id)}`, data),
    );
    return response.data;
  }

  async createUser(data: CreateUserDto): Promise<User> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<User>>(this.apiUrl, data),
    );
    return response.data;
  }

  async getUserById(id: string): Promise<User> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<User>>(`${this.apiUrl}/${encodeURIComponent(id)}`),
    );
    return response.data;
  }

  async updatePassword(id: string, password: string): Promise<User> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<User>>(`${this.apiUrl}/${encodeURIComponent(id)}/password`, { password }),
    );
    return response.data;
  }

  async sendPasswordReset(id: string): Promise<{ email: string }> {
    const response = await firstValueFrom(
      this.http.post<ApiResponse<{ email: string }>>(`${this.apiUrl}/${encodeURIComponent(id)}/password-reset`, {}),
    );
    return response.data;
  }

  async getNewsletterPreference(id: string): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.get<ApiResponse<{ isSubscribed: boolean }>>(`${this.apiUrl}/${encodeURIComponent(id)}/newsletter`),
    );
    return response.data.isSubscribed;
  }

  async setNewsletterPreference(id: string, enabled: boolean): Promise<boolean> {
    const response = await firstValueFrom(
      this.http.put<ApiResponse<{ isSubscribed: boolean }>>(`${this.apiUrl}/${encodeURIComponent(id)}/newsletter`, { enabled }),
    );
    return response.data.isSubscribed;
  }
}
