export type SaleStatus =
  | 'pending_payment'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded';

export type SalePaymentMethod =
  | 'card'
  | 'cash_on_delivery'
  | 'bank_transfer'
  | 'online';

export type SalePaymentStatus = 'unpaid' | 'paid' | 'partially_paid' | 'refunded';

export interface SaleCustomer {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

export interface SaleShippingAddress {
  country: string;
  city: string;
  cityRef?: string;
  region: string;
  areaRef?: string;
  street: string;
  building: string;
  apartment: string;
  postalCode: string;
  deliveryService: string;
  warehouse: string;
  warehouseRef?: string;
  trackingNumber: string;
  novaPoshtaDocumentRef?: string;
  novaPoshtaDocumentStatus?: string;
  novaPoshtaDocumentError?: string;
  novaPoshtaCostOnSite?: string;
  novaPoshtaEstimatedDeliveryDate?: string;
}

export interface SalePayment {
  method: SalePaymentMethod;
  status: SalePaymentStatus;
  transactionId: string;
  paidAt: string | null;
}

export interface SaleItem {
  merchandiseId: string | null;
  sku: string;
  name: string;
  image: string | null;
  selectedAttributes: Array<{ label: string; value: string }>;
  inventoryAttributeKey?: string | null;
  inventoryAttributeLabel?: string | null;
  inventoryValueKey?: string | null;
  inventoryValueLabel?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SaleInventoryAdjustment {
  state: 'none' | 'deducted' | 'returned';
  updatedAt: string | null;
}

export interface Sale {
  _id: string;
  orderNumber: string;
  status: SaleStatus;
  customer: SaleCustomer;
  shippingAddress: SaleShippingAddress;
  payment: SalePayment;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  shippingCost: number;
  grandTotal: number;
  currency: string;
  notes: string | null;
  inventoryAdjustment?: SaleInventoryAdjustment;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type CreateSaleDto = Omit<Sale, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;
export type UpdateSaleDto = Partial<CreateSaleDto>;

export interface SaleListFilter {
  search?: string;
  status?: SaleStatus;
  paymentStatus?: SalePaymentStatus;
  page?: number;
  limit?: number;
}

export interface SalePagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SaleListResponse {
  data: Sale[];
  pagination: SalePagination;
}
