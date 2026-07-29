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
  | 'google_pay'
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
  cardNetwork?: string | null;
  cardDetails?: string | null;
  tokenizationType?: string | null;
  googlePay?: {
    apiVersion: number;
    apiVersionMinor: number;
    description: string;
    paymentMethodType: string;
    token: string;
    tokenizationType: string;
    cardNetwork: string | null;
    cardDetails: string | null;
  };
}

export interface SaleItem {
  merchandiseId: string | null;
  merchandiseSlug?: string | null;
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  sku: string;
  name: string;
  image: string | null;
  selectedAttributes: Array<{ label: string; value: string }>;
  inventoryAttributeKey?: string | null;
  inventoryAttributeLabel?: string | null;
  inventoryValueKey?: string | null;
  inventoryValueLabel?: string | null;
  quantity: number;
  listUnitPrice?: number;
  discountPercentage?: number;
  discountAmount?: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SaleInventoryAdjustment {
  state: 'none' | 'deducted' | 'returned';
  updatedAt: string | null;
}

export interface Sale {
  _id: string;
  source?: 'website' | 'checkbox';
  externalId?: string;
  orderNumber: string;
  userId?: string | null;
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
  doNotCall?: boolean;
  inventoryAdjustment?: SaleInventoryAdjustment;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  checkbox?: {
    fiscalCode: string | null;
    fiscalDate: string | null;
    receiptStatus: string | null;
    receiptType: string | null;
    taxUrl: string | null;
    sentToDps: boolean;
    context?: Record<string, string | number | boolean> | null;
  };
  checkboxFiscalization?: {
    status: string;
    receiptId: string;
    fiscalCode: string | null;
    fiscalizedAt: string | null;
    updatedAt: string;
  } | null;
}

export type CreateSaleDto = Omit<Sale, '_id' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  guestId?: string;
  quickOrder?: boolean;
};
export type UpdateSaleDto = Partial<CreateSaleDto>;

export interface QuickOrderDto {
  phone: string;
  merchandiseId: string;
  inventoryValueKey?: string | null;
}

export interface SaleListFilter {
  search?: string;
  status?: SaleStatus;
  paymentStatus?: SalePaymentStatus;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface SalePagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
  grandTotal?: number;
}

export interface SaleListResponse {
  data: Sale[];
  pagination: SalePagination;
}
