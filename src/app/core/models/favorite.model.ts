import { Merchandise } from './merchandise.model';

export interface FavoriteProductSnapshot {
  merchandiseId: string;
  sku: string;
  name: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  image: string | null;
  images: string[];
  salePrice: number;
  discountPercentage: number;
  currency: string;
}

export interface Favorite {
  _id: string;
  userId: string;
  user: { userId: string; email: string };
  merchandiseId: string;
  product: Merchandise | FavoriteProductSnapshot | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

