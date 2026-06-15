import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Merchandise } from '../../core/models/merchandise.model';

@Component({
  selector: 'app-public-product-card',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a class="card" [class.card--emphasis]="emphasis" [routerLink]="['/product', product.slug]">
      <div class="media">
        @if (image(0)) {
          <img [src]="optimizedUrl(image(0))" [alt]="product.name" class="primary" loading="lazy" />
          @if (product.images.length > 1) {
            <img [src]="optimizedUrl(image(1))" [alt]="product.name" class="hover" loading="lazy" />
          }
        } @else {
          <div class="placeholder"><i class="ri-image-line"></i></div>
        }
        <span class="stock">{{ stockLabel() }}</span>
        @if (product.images.length > 1) {
          <span class="gallery"><i class="ri-gallery-line"></i> {{ product.images.length }}</span>
        }
      </div>
      <div class="body">
        <span class="sku">{{ product.sku }}</span>
        <h3>{{ product.name }}</h3>
        <div class="foot">
          <strong>{{ formatPrice() }}</strong>
          <span>Переглянути <i class="ri-arrow-right-line"></i></span>
        </div>
      </div>
    </a>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .card { height: 100%; display: block; overflow: hidden; color: #171714; background: rgba(255,255,255,.18); text-decoration: none; }
    .media { position: relative; aspect-ratio: 3 / 4; overflow: hidden; background: #e7e1d7; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: opacity .35s, transform .6s; }
    img.hover { opacity: 0; }
    .card:hover img.primary { transform: scale(1.025); }
    .card:hover img.hover { opacity: 1; transform: scale(1.025); }
    .placeholder { height: 100%; display: grid; place-items: center; color: rgba(23,23,20,.3); font-size: 40px; }
    .stock, .gallery { position: absolute; top: 10px; padding: 5px 7px; background: rgba(245,242,235,.9); font-size: 8px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .stock { left: 10px; } .gallery { right: 10px; }
    .body { padding: 14px 12px 16px; }
    .sku { color: rgba(23,23,20,.55); font-size: 9px; letter-spacing: .1em; }
    h3 { min-height: 2.7em; margin: .55rem 0 1.3rem; font-size: 13px; font-weight: 500; line-height: 1.35; }
    .foot { display: flex; justify-content: space-between; gap: .5rem; font-size: 11px; }
    .foot span { opacity: 0; transition: opacity .2s; } .card:hover .foot span { opacity: 1; }
    .card--emphasis h3 { margin-bottom: 1rem; font-size: clamp(16px, 1.35vw, 21px); font-weight: 600; line-height: 1.25; }
    .card--emphasis .foot { align-items: center; font-size: 13px; }
    .card--emphasis .foot strong { color: #c85436; font-size: clamp(16px, 1.25vw, 20px); }
  `],
})
export class PublicProductCardComponent {
  @Input({ required: true }) product!: Merchandise;
  @Input() emphasis = false;

  image(index: number): string { return this.product.images?.[index] ?? ''; }
  optimizedUrl(url: string): string {
    return url.includes('res.cloudinary.com') ? url.replace('/upload/', '/upload/f_auto,q_auto,w_700/') : url;
  }
  stockLabel(): string { return (this.product.inventory?.total_quantity ?? 0) > 0 ? 'В наявності' : 'Під замовлення'; }
  formatPrice(): string {
    return new Intl.NumberFormat('uk-UA', { style: 'currency', currency: this.product.currency, maximumFractionDigits: 0 }).format(this.product.salePrice);
  }
}
