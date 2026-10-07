interface IPricingTier {
  minKm: number; // inclusive
  maxKm?: number; // undefined = infinity
  pricePerKm: number;
}

export interface ILoadVariant {
  _id: string;
  maxLoadKg: number;
  baseFare: number;
  pricingTiers: IPricingTier[];
  isActive: boolean;
}

export interface IVehicleType extends Document {
  _id: string;
  key: string; // motorcycle, sedan, l300, closed_van, wing_van
  refCode: string; // MC, SD, L3 — immutable booking-ref code
  name: string; // UI display
  imageUrl: string; // Cloudinary
  desc: string;
  variants: ILoadVariant[];
  freeServices: Service[];
  paidServices: Service[];
  searchConfig: SearchConfig;
  isActive: boolean;
}

export interface SearchConfig {
  initialRadiusKm: number;
  incrementKm: number;
  maxRadiusKm: number;
  intervalMs: number;
}

export interface SelectedVehicle {
  _id: string;
  key: string;
  refCode: string;
  name: string;
  imageUrl: string;
  freeServices: Service[];
  paidServices: Service[];
  searchConfig: SearchConfig;
  variant: ILoadVariant | null;
}

export interface Service {
  key: string; // extra_helper, extra_waiting_time, special_help, etc.
  name: string; // Display name: "Extra Helper", "Extra Waiting Time"
  desc: string; // Description of what this service includes
  price: number; // Price in PHP (0 for free services)
  unit: string; // "per person", "per 15 minutes", "per service", etc.
  isQuantifiable: boolean; // true if user can request multiple (like extra helpers), false for one-time services
  maxQuantity?: number; // Optional: max quantity user can request (e.g., max 5 helpers)
  isActive: boolean;
  quantity?: number; // number of units requested by user
}
