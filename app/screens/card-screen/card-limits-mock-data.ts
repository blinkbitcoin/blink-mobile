import { TransactionType } from "./card-limits-screen"

export type CardLimitsData = {
  currentLimits: {
    dailySpending: string
    monthlySpending: string
  }
  spendingLimits: {
    daily: string
    monthly: string
  }
  atmLimits: {
    daily: string
    monthly: string
  }
  transactionTypes: Record<TransactionType, boolean>
}

export const MOCK_CARD_LIMITS: CardLimitsData = {
  currentLimits: {
    dailySpending: "$1,000",
    monthlySpending: "$5,000",
  },
  spendingLimits: {
    daily: "1000",
    monthly: "5000",
  },
  atmLimits: {
    daily: "500",
    monthly: "2000",
  },
  transactionTypes: {
    ecommerce: true,
    atm: true,
    contactless: true,
  },
}
