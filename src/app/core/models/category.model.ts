import { ReferenceOption, ReferenceType, ReferenceValue } from './reference.model';

/**
 * Specification stored on a category.
 * Contains the category-level overrides (isRequired, sortOrder) plus a full
 * snapshot of the reference definition so the LEFT column can be rendered
 * without a separate /api/references lookup.
 */
export interface CategorySpecification {
  // Category-level fields
  referenceId: string;
  isRequired: boolean;
  sortOrder: number;

  // Embedded reference snapshot (may be absent on old documents — handle gracefully)
  slug: string;
  name?: string;
  type?: ReferenceType;
  description?: string | null;
  isFilterable?: boolean;
  isVariant?: boolean;
  isStockTrackable?: boolean;
  isActive?: boolean;
  placeholder?: string | null;
  helperText?: string | null;
  icon?: string | null;
  unit?: string | null;
  min?: number | null;
  max?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  regex?: string | null;
  defaultValue?: ReferenceValue;
  options?: ReferenceOption[];
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface Category {
  _id: string;
  id?: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  parentId: string | null;
  level: number;
  path: string;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  specifications: CategorySpecification[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string[];
  canonicalUrl: string | null;
  ogImage: string | null;
  image: string | null;
  coverImage: string | null;
  bannerImage: string | null;
  icon: string | null;
  images: string[];
}

export interface CategoryFormData {
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
  isVisible: boolean;
  isFeatured: boolean;
  specifications: CategorySpecification[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  canonicalUrl: string;
  ogImage: string;
  image: string;
  coverImage: string;
  bannerImage: string;
  icon: string;
  images: string[];
}
