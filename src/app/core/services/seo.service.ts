import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { environment } from '../../../environments/environment';

export interface SeoData {
  title: string;
  description?: string | null;
  keywords?: string[] | null;
  canonicalUrl?: string | null;
  ogImage?: string | null;
  type?: 'website' | 'product';
}

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private titleService = inject(Title);
  private meta = inject(Meta);
  private document = inject(DOCUMENT);

  setPage(data: SeoData): void {
    const canonicalUrl = this.absoluteUrl(data.canonicalUrl || this.document.location?.pathname || '/');
    const title = this.clean(data.title) || 'Ulia';
    const description = this.truncate(this.clean(data.description) || 'Ulia catalog', 160);
    const image = data.ogImage ? this.absoluteUrl(data.ogImage) : null;

    this.titleService.setTitle(title);
    this.upsert('name', 'description', description);
    this.upsert('property', 'og:title', title);
    this.upsert('property', 'og:description', description);
    this.upsert('property', 'og:type', data.type || 'website');
    this.upsert('property', 'og:url', canonicalUrl);
    this.upsert('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    this.upsert('name', 'twitter:title', title);
    this.upsert('name', 'twitter:description', description);

    if (data.keywords?.length) {
      this.upsert('name', 'keywords', data.keywords.filter(Boolean).join(', '));
    } else {
      this.meta.removeTag('name="keywords"');
    }

    if (image) {
      this.upsert('property', 'og:image', image);
      this.upsert('name', 'twitter:image', image);
    } else {
      this.meta.removeTag('property="og:image"');
      this.meta.removeTag('name="twitter:image"');
    }

    this.setCanonical(canonicalUrl);
  }

  private upsert(attr: 'name' | 'property', key: string, content: string): void {
    this.meta.updateTag({ [attr]: key, content });
  }

  private setCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private absoluteUrl(value: string): string {
    if (/^https?:\/\//i.test(value)) return value;
    const rawPath = value.startsWith('/') ? value : `/${value}`;
    const path = rawPath
      .split('/')
      .map((segment, index) => index === 0 ? segment : encodeURIComponent(decodeURIComponent(segment)))
      .join('/');
    return `${environment.siteUrl}${path}`;
  }

  private clean(value: string | null | undefined): string {
    return String(value || '').trim();
  }

  private truncate(value: string, maxLength: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return `${normalized.slice(0, maxLength - 3).trim()}...`;
  }
}
