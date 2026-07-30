import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  selector: 'app-optimized-image',
  standalone: true,
  imports: [NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.fill-container]': 'fillContainer',
  },
  template: `
    <span class="frame" [class.loaded]="loaded()" [style.aspect-ratio]="fillContainer ? null : width + ' / ' + height">
      <span class="skeleton" aria-hidden="true"></span>
      @if (isCloudinary() && responsive) {
        <img
          [ngSrc]="src"
          [alt]="alt"
          [width]="width"
          [height]="height"
          [priority]="priority"
          [ngSrcset]="srcset"
          [sizes]="sizes"
          [style.object-fit]="fit"
          [style.object-position]="objectPosition"
          decoding="async"
          (load)="loaded.set(true)"
          (error)="loaded.set(true)"
        />
      } @else if (isCloudinary()) {
        <img
          [ngSrc]="src"
          [alt]="alt"
          [width]="width"
          [height]="height"
          [priority]="priority"
          [disableOptimizedSrcset]="true"
          [style.object-fit]="fit"
          [style.object-position]="objectPosition"
          decoding="async"
          (load)="loaded.set(true)"
          (error)="loaded.set(true)"
        />
      } @else {
        <img
          [src]="src"
          [alt]="alt"
          [attr.width]="width"
          [attr.height]="height"
          [attr.loading]="priority ? 'eager' : 'lazy'"
          [attr.fetchpriority]="priority ? 'high' : 'auto'"
          [style.object-fit]="fit"
          [style.object-position]="objectPosition"
          decoding="async"
          (load)="loaded.set(true)"
          (error)="loaded.set(true)"
        />
      }
    </span>
  `,
  styles: [`
    :host, .frame {
      display: block;
      width: 100%;
      height: 100%;
      min-width: 0;
    }
    :host(.fill-container) {
      position: absolute;
      inset: 0;
      width: auto;
      height: auto;
    }
    :host(.fill-container) .frame {
      width: 100%;
      height: 100%;
      aspect-ratio: auto;
    }
    .frame {
      position: relative;
      overflow: hidden;
      background: var(--un-soft, #f1f0eb);
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      opacity: 0;
      transition: opacity .25s ease;
    }
    .loaded img { opacity: 1; }
    .skeleton {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(100deg, transparent 20%, rgba(255,255,255,.55) 45%, transparent 70%),
        var(--un-soft, #f1f0eb);
      background-size: 220% 100%;
      animation: image-shimmer 1.25s ease-in-out infinite;
      transition: opacity .2s ease;
    }
    .loaded .skeleton {
      opacity: 0;
      pointer-events: none;
      animation: none;
    }
    @keyframes image-shimmer {
      from { background-position: 120% 0; }
      to { background-position: -120% 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton { animation: none; }
      img { transition: none; }
    }
  `],
})
export class OptimizedImageComponent implements OnChanges {
  @Input({ required: true }) src = '';
  @Input() alt = '';
  @Input() width = 700;
  @Input() height = 933;
  @Input() priority = false;
  @Input() responsive = true;
  @Input() fit: 'cover' | 'contain' = 'cover';
  @Input() objectPosition = 'center';
  @Input() fillContainer = false;
  @Input() sizes = '(max-width: 560px) 50vw, (max-width: 1100px) 33vw, 20vw';
  @Input() srcset = '240w, 360w, 480w, 700w, 1000w, 1400w';

  protected loaded = signal(false);
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] && !changes['src'].firstChange) this.loaded.set(false);
  }
  protected isCloudinary(): boolean {
    return this.src.includes('res.cloudinary.com');
  }
}
