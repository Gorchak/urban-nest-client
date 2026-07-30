import { normalizeCategoryTree } from './categories.service';
import { Category } from '../models/category.model';

const category = (overrides: Partial<Category>): Category => ({
  _id: '',
  name: '',
  slug: '',
  description: null,
  shortDescription: null,
  parentId: null,
  level: 0,
  path: '',
  sortOrder: 0,
  isActive: true,
  isVisible: true,
  isFeatured: false,
  specifications: [],
  createdAt: '',
  updatedAt: '',
  deletedAt: null,
  seoTitle: null,
  seoDescription: null,
  seoKeywords: [],
  canonicalUrl: null,
  ogImage: null,
  image: null,
  coverImage: null,
  bannerImage: null,
  icon: null,
  images: [],
  ...overrides,
});

describe('normalizeCategoryTree', () => {
  it('restores known orphaned clothing children', () => {
    const result = normalizeCategoryTree([
      category({ _id: 'clothing-id', name: 'Одяг', slug: 'clothing' }),
      category({ _id: 'dresses-id', name: 'Сукні', slug: 'dresses' }),
      category({ _id: 'shoes-id', name: 'Взуття', slug: 'shoes' }),
    ]);

    expect(result.find((item) => item._id === 'dresses-id')?.parentId).toBe('clothing-id');
    expect(result.find((item) => item._id === 'shoes-id')?.parentId).toBeNull();
  });

  it('never overrides an explicit parent', () => {
    const result = normalizeCategoryTree([
      category({ _id: 'clothing-id', slug: 'clothing' }),
      category({ _id: 'dresses-id', slug: 'dresses', parentId: 'custom-parent' }),
    ]);

    expect(result[1].parentId).toBe('custom-parent');
  });
});
