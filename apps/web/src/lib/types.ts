import type { ItemType, LeadStatus, PaymentStatus } from "@buffet/shared";

/** Catalog entities as returned by the API (dates serialized as strings). */
export interface Item {
  id: string;
  organizationId: string;
  name: string;
  type: ItemType;
  category: string | null;
  basePrice: string;
  isActive: boolean;
  createdAt: string;
}

export interface Package {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  pricePerPerson: string;
  isActive: boolean;
  sortOrder: number;
  isFeatured: boolean;
  createdAt: string;
}

/** Uma foto da galeria do pacote (RF28). */
export interface PackageImage {
  id: string;
  packageId: string;
  url: string;
  sortOrder: number;
  createdAt: string;
}

export interface PackageWithItems extends Package {
  itemIds: string[];
  images: PackageImage[];
}

/** A lead/negotiation in the sales funnel (RF19). */
export interface Lead {
  id: string;
  organizationId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string;
  eventDate: string | null;
  guestCount: number | null;
  packageId: string | null;
  totalValue: string | null;
  status: LeadStatus;
  lostReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A lead enriched by the detail endpoint (RF21/RF22). */
export interface LeadDetail extends Lead {
  packageName: string | null;
  conflictCount: number;
}

/** A financial installment (RF23/RF24). */
export interface FinancialPayment {
  id: string;
  budgetId: string;
  dueDate: string;
  amount: string;
  status: PaymentStatus;
  paymentMethod: string | null;
  paidAt: string | null;
  receiptUrl: string | null;
  createdAt: string;
}

/** Owner-only billing totals + pending installments (RF23/RF24). */
export interface FinanceSummary {
  receivable: string;
  received: string;
  pending: {
    id: string;
    budgetId: string;
    customerName: string;
    dueDate: string;
    amount: string;
    status: string;
  }[];
}
