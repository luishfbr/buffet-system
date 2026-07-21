import type { ItemType, LeadStatus } from "@buffet/shared";

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
  createdAt: string;
}

export interface PackageWithItems extends Package {
  itemIds: string[];
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
