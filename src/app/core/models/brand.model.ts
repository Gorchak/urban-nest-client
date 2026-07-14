export interface Brand {
  _id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  categoryIds: string[];
  website: string | null;
  sortOrder: number;
  isFeatured: boolean;
  isActive: boolean;
  isVisible: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  canonicalUrl: string | null;
  ogImage: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type BrandPayload = Omit<Brand, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export interface BrandListFilter {
  search?: string;
  isActive?: boolean;
  isVisible?: boolean;
  isFeatured?: boolean;
  page?: number;
  limit?: number;
}
