export interface WalletState {
  daily_spent_usd: number;
  daily_reset_date: string;
  total_spent_usd: number;
  agent_address?: string;
}

const state: WalletState = {
  daily_spent_usd: 0,
  daily_reset_date: new Date().toISOString().slice(0, 10),
  total_spent_usd: 0,
};

function resetDailyIfNeeded(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (state.daily_reset_date !== today) {
    state.daily_spent_usd = 0;
    state.daily_reset_date = today;
  }
}

export function getWalletState(agentAddress?: string): WalletState & {
  max_daily_spend_usd: number;
  max_single_tx_usd: number;
  max_api_spend_usd: number;
} {
  resetDailyIfNeeded();
  return {
    ...state,
    agent_address: agentAddress,
    max_daily_spend_usd: Number(process.env.MAX_DAILY_SPEND_USD ?? 10),
    max_single_tx_usd: Number(process.env.MAX_SINGLE_TX_USD ?? 5),
    max_api_spend_usd: Number(process.env.MAX_API_SPEND_USD ?? 1),
  };
}

export function assertCanSpend(amountUsd: number, category: "api" | "checkout"): void {
  resetDailyIfNeeded();
  const maxDaily = Number(process.env.MAX_DAILY_SPEND_USD ?? 10);
  const maxSingle = Number(process.env.MAX_SINGLE_TX_USD ?? 5);
  const maxApi = Number(process.env.MAX_API_SPEND_USD ?? 1);

  if (amountUsd > maxSingle) {
    throw new Error(`Transaction $${amountUsd} exceeds max single tx $${maxSingle}`);
  }
  if (state.daily_spent_usd + amountUsd > maxDaily) {
    throw new Error(`Daily spend limit $${maxDaily} would be exceeded`);
  }
  if (category === "api") {
    const apiSpent = state.daily_spent_usd;
    if (apiSpent + amountUsd > maxApi) {
      throw new Error(`API spend limit $${maxApi} would be exceeded`);
    }
  }
}

export function recordSpend(amountUsd: number): void {
  resetDailyIfNeeded();
  state.daily_spent_usd += amountUsd;
  state.total_spent_usd += amountUsd;
}

export function resetWalletForDemo(): void {
  state.daily_spent_usd = 0;
  state.total_spent_usd = 0;
  state.daily_reset_date = new Date().toISOString().slice(0, 10);
}
