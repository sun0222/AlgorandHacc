export interface CorridorTrend {
  corridor: string;
  origin: string;
  destination: string;
  avg_freight_usd_per_kg: number;
  demand_index: number; // 0–100, higher = more congested
  recommended: boolean;
  insight: string;
}

/**
 * Returns mock corridor analytics.
 * In production this would pull real-time logistics data.
 */
export function getCorridorAnalytics(): CorridorTrend[] {
  return [
    {
      corridor: "DE-NL",
      origin: "DE",
      destination: "NL",
      avg_freight_usd_per_kg: 0.42,
      demand_index: 35,
      recommended: true,
      insight:
        "Low congestion on Rhine corridor — freight rates 18% below Q1 average. Best window for glass shipments.",
    },
    {
      corridor: "DE-FR",
      origin: "DE",
      destination: "FR",
      avg_freight_usd_per_kg: 0.61,
      demand_index: 72,
      recommended: false,
      insight:
        "High demand on DE-FR route due to seasonal food production. Expect 2-day delays and elevated rates.",
    },
    {
      corridor: "DE-IT",
      origin: "DE",
      destination: "IT",
      avg_freight_usd_per_kg: 0.78,
      demand_index: 58,
      recommended: false,
      insight:
        "Brenner Pass capacity constraints. Moderate congestion with premium pricing for fragile goods.",
    },
  ];
}
