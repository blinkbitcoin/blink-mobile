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
