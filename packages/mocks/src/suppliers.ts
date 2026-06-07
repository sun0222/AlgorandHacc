export interface PackagingSupplier {
  id: string;
  name: string;
  city: string;
  country: string;
  product: string;
  unit_price_usd: number;
  moq: number;
  lead_days: number;
  food_grade: boolean;
}

export const PACKAGING_SUPPLIERS: PackagingSupplier[] = [
  {
    id: "de-glass-1",
    name: "RheinGlass GmbH",
    city: "Cologne",
    country: "DE",
    product: "Glass jar 250ml + lid",
    unit_price_usd: 0.72,
    moq: 200,
    lead_days: 7,
    food_grade: true,
  },
  {
    id: "de-glass-2",
    name: "BayernPack AG",
    city: "Munich",
    country: "DE",
    product: "Glass jar 250ml + lid",
    unit_price_usd: 0.81,
    moq: 100,
    lead_days: 5,
    food_grade: true,
  },
  {
    id: "de-glass-3",
    name: "NordPack GmbH",
    city: "Hamburg",
    country: "DE",
    product: "Glass jar 250ml + lid",
    unit_price_usd: 0.68,
    moq: 500,
    lead_days: 10,
    food_grade: true,
  },
  {
    id: "de-glass-4",
    name: "ElbePack GmbH",
    city: "Dresden",
    country: "DE",
    product: "Glass jar 250ml + lid",
    unit_price_usd: 0.89,
    moq: 50,
    lead_days: 4,
    food_grade: true,
  },
];
