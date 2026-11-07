export type Category = "phone" | "tablet" | "laptop" | "gpu";
export type Currency = "CNY" | "USD" | "HKD";
export interface Market { region: string; currency: Currency }
export interface Device extends Market {
  id: string;
  name: string;
  category: Category;
  brand: string;
  model: string;
  configuration: string;
  purchaseDate: string;
  purchasePrice: number;
  condition?: string;
  battery?: string;
  notes?: string;
  tags?: string;
  demo?: boolean;
}
export type PriceType = "manual-reference" | "simulated" | "listing" | "transaction" | "buyback";
export interface Valuation extends Market {
  id: string;
  deviceId: string;
  low: number;
  high: number;
  dataDate: string;
  recordedAt: string;
  source: string;
  priceType: PriceType;
  provider: "manual" | "demo" | "real";
}
export interface Ledger { version: 1; devices: Device[]; valuations: Valuation[] }
export interface DeviceDraft {
  name: string;
  category: Category | "";
  brand: string;
  model: string;
  configuration: string;
  purchaseDate: string;
  purchasePrice: string;
  condition: string;
  battery: string;
  notes: string;
  tags: string;
}
export interface ExtractedDevice {
  name: string | null;
  category: Category | null;
  brand: string | null;
  model: string | null;
  configuration: string | null;
  purchaseDate: string | null;
  purchaseDateText: string | null;
  purchasePrice: number | null;
  notes: string | null;
}
