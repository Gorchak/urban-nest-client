import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface NewsletterCampaign {
  _id: string; status: 'processing' | 'completed' | 'failed'; completedAt?: string;
  productIds: string[]; subscribersCount: number; emailsSent: number; emailsFailed: number;
  error?: string | null; retryAttempts?: number;
}
export interface NewsletterPreview {
  newProductsCount: number; subscribersCount: number; totalSubscribers: number;
  products: Array<{ _id: string; name: string; images?: string[] }>;
  lastCampaign?: NewsletterCampaign; campaigns: NewsletterCampaign[];
}
export interface NewsletterSubscriber {
  _id: string; email: string; isActive: boolean; subscribedAt: string;
  unsubscribedAt?: string | null; lastEmailSentAt?: string; createdAt: string;
}
export interface Pagination { total: number; page: number; limit: number; pages: number; }
interface ApiResponse<T> { data: T; message: string; pagination?: Pagination; }

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private http = inject(HttpClient);
  private url = `${environment.apiUrl}/newsletter`;
  async subscribe(email: string): Promise<string> {
    return (await firstValueFrom(this.http.post<ApiResponse<unknown>>(`${this.url}/subscribe`, { email }))).message;
  }
  async unsubscribe(token: string): Promise<string> {
    return (await firstValueFrom(this.http.get<ApiResponse<unknown>>(`${this.url}/unsubscribe`, { params: { token } }))).message;
  }
  async preview(): Promise<NewsletterPreview> {
    return (await firstValueFrom(this.http.get<ApiResponse<NewsletterPreview>>(`${environment.apiUrl}/admin/newsletter/preview`))).data;
  }
  async send(): Promise<{ sent: boolean; reason?: string; emailsSent?: number; emailsFailed?: number; error?: string | null }> {
    return (await firstValueFrom(this.http.post<ApiResponse<any>>(`${environment.apiUrl}/admin/newsletter/send`, {}))).data;
  }
  async getSubscribers(page = 1, limit = 50): Promise<{ data: NewsletterSubscriber[]; pagination: Pagination }> {
    const response = await firstValueFrom(this.http.get<ApiResponse<NewsletterSubscriber[]>>(
      `${environment.apiUrl}/admin/newsletter/subscribers`, { params: { page, limit } },
    ));
    return { data: response.data, pagination: response.pagination || { total: 0, page, limit, pages: 0 } };
  }
  async deleteSubscriber(id: string): Promise<void> {
    await firstValueFrom(this.http.delete(`${environment.apiUrl}/admin/newsletter/subscribers/${encodeURIComponent(id)}`));
  }
  async retryCampaign(id: string): Promise<{ sent: boolean; reason?: string; emailsSent?: number; emailsFailed?: number; error?: string | null }> {
    return (await firstValueFrom(this.http.post<ApiResponse<any>>(
      `${environment.apiUrl}/admin/newsletter/campaigns/${encodeURIComponent(id)}/retry`, {},
    ))).data;
  }
}
