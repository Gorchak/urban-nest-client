import { Merchandise } from './merchandise.model';

export interface CartItem {
  merchandiseId: string;
  inventoryValueKey: string | null;
  inventoryValueLabel: string | null;
  quantity: number;
  product: Merchandise | null;
}

export interface Cart {
  _id: string;
  userId: string | null;
  guestId: string | null;
  user: { userId: string; email: string };
  items: CartItem[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface AddCartItemDto {
  merchandiseId: string;
  inventoryValueKey?: string | null;
  inventoryValueLabel?: string | null;
  quantity?: number;
}
