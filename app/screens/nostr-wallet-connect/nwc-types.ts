export const NWC_PERMISSIONS = [
  "get_info",
  "get_balance",
  "make_invoice",
  "pay_invoice",
  "lookup_invoice",
  "list_transactions",
  "notifications:payment_sent",
  "notifications:payment_received",
] as const

export type NwcPermission = (typeof NWC_PERMISSIONS)[number]

export const DEFAULT_NWC_PERMISSIONS: ReadonlyArray<NwcPermission> = [
  "get_info",
  "get_balance",
  "pay_invoice",
]

export const NWC_BUDGET_PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "NEVER"] as const

export type NwcBudgetPeriod = (typeof NWC_BUDGET_PERIODS)[number]

export type NwcGraphqlPermission =
  | "GET_INFO"
  | "GET_BALANCE"
  | "MAKE_INVOICE"
  | "PAY_INVOICE"
  | "LOOKUP_INVOICE"
  | "LIST_TRANSACTIONS"
  | "NOTIFICATIONS_PAYMENT_SENT"
  | "NOTIFICATIONS_PAYMENT_RECEIVED"

const NWC_GRAPHQL_PERMISSION_BY_NIP47_PERMISSION: Record<
  NwcPermission,
  NwcGraphqlPermission
> = {
  "get_info": "GET_INFO",
  "get_balance": "GET_BALANCE",
  "make_invoice": "MAKE_INVOICE",
  "pay_invoice": "PAY_INVOICE",
  "lookup_invoice": "LOOKUP_INVOICE",
  "list_transactions": "LIST_TRANSACTIONS",
  "notifications:payment_sent": "NOTIFICATIONS_PAYMENT_SENT",
  "notifications:payment_received": "NOTIFICATIONS_PAYMENT_RECEIVED",
}

export const toNwcGraphqlPermission = (permission: NwcPermission) =>
  NWC_GRAPHQL_PERMISSION_BY_NIP47_PERMISSION[permission]
