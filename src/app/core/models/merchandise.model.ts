import { ReferenceType, ReferenceValue } from './reference.model';

/**
 * A single dynamic specification stored on a merchandise item.
 * All product characteristics work exclusively through this structure —
 * no hardcoded fields like color / size / material.
 */
export interface MerchandiseSpecification {
  referenceId: string;
  slug: string;
  type: ReferenceType;
  value: ReferenceValue;
}

export type MerchandiseCurrency = 'UAH' | 'USD' | 'EUR';

export type MerchandiseOwnershipType =
  | 'owned'
  | 'consignment'
  | 'dropshipping'
  | 'partner'
  | 'rental';

export interface InventoryTrackedAttribute {
  attribute_key: string;
  attribute_label: string;
}

export interface InventoryAttributeQuantity {
  value_key: string;
  value_label: string;
  quantity: number;
}

export interface MerchandiseInventory {
  total_quantity: number;
  tracked_attribute: InventoryTrackedAttribute | null;
  attribute_quantities: InventoryAttributeQuantity[];
}

export interface Merchandise {
  _id: string;
  sku: string;
  name: string;
  slug: string;
  categoryId: string;
  categorySlug: string;
  description: string | null;
  shortDescription: string | null;
  specifications: MerchandiseSpecification[];
  images: string[];
  inventory: MerchandiseInventory;
  purchasePrice: number;
  salePrice: number;
  discountPercentage: number;
  retailPrice: number;
  currency: MerchandiseCurrency;
  isActive: boolean;
  isVisible: boolean;
  isNewArrival: boolean;
  ownershipType: MerchandiseOwnershipType;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  canonicalUrl: string | null;
  ogImage: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateMerchandiseDto {
  sku: string;
  name: string;
  slug: string;
  categoryId: string;
  description: string | null;
  shortDescription: string | null;
  specifications: MerchandiseSpecification[];
  images: string[];
  inventory: MerchandiseInventory;
  purchasePrice: number;
  salePrice: number;
  discountPercentage: number;
  retailPrice: number;
  currency: MerchandiseCurrency;
  isActive: boolean;
  isVisible: boolean;
  isNewArrival: boolean;
  ownershipType: MerchandiseOwnershipType;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  canonicalUrl: string | null;
  ogImage: string | null;
}

export type UpdateMerchandiseDto = Partial<CreateMerchandiseDto>;

export interface MerchandiseListFilter {
  categoryId?: string;
  categorySlug?: string;
  includeChildren?: boolean;
  search?: string;
  isActive?: boolean;
  isVisible?: boolean;
  isNewArrival?: boolean;
  inStock?: boolean;
  outOfStock?: boolean;
  inventoryAttributeKey?: string;
  inventoryValueKey?: string;
  inventoryInStock?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'createdAt' | 'name' | 'salePrice' | 'stockQuantity';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface MerchandisePagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface MerchandiseListResponse {
  data: Merchandise[];
  pagination: MerchandisePagination;
}

export function getDiscountedPrice(product: Pick<Merchandise, 'salePrice' | 'discountPercentage'>): number {
  const price = Math.max(0, Number(product.salePrice) || 0);
  const discount = Math.min(100, Math.max(0, Number(product.discountPercentage) || 0));
  return Math.round(price * (1 - discount / 100) * 100) / 100;
}

export function hasDiscount(product: Pick<Merchandise, 'discountPercentage'>): boolean {
  return Number(product.discountPercentage) > 0;
}
