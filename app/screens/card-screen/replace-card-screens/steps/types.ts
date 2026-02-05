export const Issue = {
  Lost: "lost",
  Stolen: "stolen",
  Damaged: "damaged",
} as const

export type IssueType = (typeof Issue)[keyof typeof Issue]

export const Delivery = {
  Standard: "standard",
  Express: "express",
} as const

export type DeliveryType = (typeof Delivery)[keyof typeof Delivery]

export type DeliveryOptionConfig = {
  minDays: number
  maxDays: number
  priceUsd: number
}

export type ReplaceCardDeliveryConfig = Record<DeliveryType, DeliveryOptionConfig>
