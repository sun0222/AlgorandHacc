export interface FreightOption {
  carrier_id: string;
  carrier_name: string;
  origin_country: string;
  destination_country: string;
  cost_usd: number;
  eta_days: number;
  corridor: string;
}

export function getFreightQuotes(params: {
  origin: string;
  destination: string;
  weight_kg: number;
  units: number;
}): FreightOption[] {
  const { origin, destination, weight_kg, units } = params;
  const corridor = `${origin}-${destination}`;
  const base = 18 + weight_kg * 0.45 + units * 0.002;

  return [
    {
      carrier_id: "eu-freight-express",
      carrier_name: "EU Freight Express",
      origin_country: origin,
      destination_country: destination,
      cost_usd: Math.round((base * 1.15) * 100) / 100,
      eta_days: 3,
      corridor,
    },
    {
      carrier_id: "rhine-logistics",
      carrier_name: "Rhine Logistics",
      origin_country: origin,
      destination_country: destination,
      cost_usd: Math.round(base * 100) / 100,
      eta_days: 5,
      corridor,
    },
  ];
}
