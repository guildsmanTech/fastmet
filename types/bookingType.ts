export type BookingTypeKey = "asap" | "pooling" | "schedule";

/** Trip-fare range (base + distance, whole pesos) and its percent: 80 = +80%, -20 = -20%. */
export interface PriceModifierTier {
  minPrice: number;
  maxPrice?: number | null;
  percent: number;
}

export interface SubOption {
  key: string;
  name: string;
  icon: string;
  subtext?: string;
  description: string;
  priceModifierTiers: PriceModifierTier[];
  isActive: boolean;
  order: number;
}

export interface BookingTypeConfig {
  _id: string;
  key: BookingTypeKey;
  name: string;
  icon: string;
  subtext?: string;
  description: string;
  note: string;
  priceModifierTiers: PriceModifierTier[];
  subOptions: SubOption[];
  isActive: boolean;
  order: number;
}
