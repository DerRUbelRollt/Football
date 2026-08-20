export interface PenaltyBalanceParts {
  moneyText: string;
  crateText: string;
  hasDebt: boolean;
}

export function formatPenaltyBalance(penalty: number, crates: number): PenaltyBalanceParts {
  return {
    moneyText: penalty > 0 ? `${penalty}€` : "-",
    crateText: crates > 0 ? `${crates}x🍺` : "- 🍺",
    hasDebt: penalty > 0 || crates > 0,
  };
}
