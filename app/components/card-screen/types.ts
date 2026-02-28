export const CardTransactionUiStatus = {
  Pending: "pending",
  Completed: "completed",
  Declined: "declined",
  Reversed: "reversed",
} as const

export type CardTransactionUiStatus =
  (typeof CardTransactionUiStatus)[keyof typeof CardTransactionUiStatus]

export type CardTransactionDisplay = {
  id: string
  merchantName: string
  timeAgo: string
  amount: string
  status: CardTransactionUiStatus
}

export type CardTransactionGroup = {
  date: string
  transactions: CardTransactionDisplay[]
}
