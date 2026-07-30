import { ImageLoaderConfig } from '@angular/common';

export function optimizedImageLoader(config: ImageLoaderConfig): string {
  const src = String(config.src || '');
  if (!src.includes('res.cloudinary.com') || !src.includes('/upload/')) return src;

  const width = config.width ? `,w_${Math.round(config.width)}` : '';
  const transform = `f_auto,q_auto:eco,c_limit${width},dpr_auto`;
  return src.replace('/upload/', `/upload/${transform}/`);
}
