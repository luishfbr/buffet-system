import type { ItemType } from "@buffet/shared";

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
