import {
  NwcBudgetPeriod,
  NwcGraphqlPermission,
  toNwcGraphqlPermission,
} from "./nwc-types"
import { ParsedNwcUri } from "./nwc-uri"

type ValidParsedNwcUri = Extract<ParsedNwcUri, { valid: true }>

export type NwcBudgetInput = {
  amountSats: number
  period: NwcBudgetPeriod
}

export type NwcConnectionCreateInput = {
  nwcUri: string
  alias?: string
  permissions: ReadonlyArray<NwcGraphqlPermission>
  budgets?: ReadonlyArray<NwcBudgetInput>
}

export type NwcConnectionUpdateInput = {
  connectionId: string
  alias?: string
  budgets?: ReadonlyArray<NwcBudgetInput> | null
}

export type NwcConnectionCreateErrorCode =
  | "DUPLICATE_CONNECTION"
  | "NETWORK_ERROR"
  | "RELAY_UNREACHABLE"
  | "UNSUPPORTED_PERMISSIONS"
  | "UNKNOWN_ERROR"

export type NwcConnectionCreateError = {
  code: NwcConnectionCreateErrorCode
  message: string
  retryable?: boolean
  replaceable?: boolean
}

export const buildNwcConnectionUri = ({
  serverPubkey,
  relay,
  secret,
}: {
  serverPubkey: string
  relay: string
  secret: string
}) => {
  const params = new URLSearchParams({ relay, secret })
  return `nostr+walletconnect://${serverPubkey}?${params.toString()}`
}

export const buildNwcConnectionCreateInput = ({
  parsedUri,
  alias,
  budgetSats,
  budgetPeriod,
}: {
  parsedUri: ValidParsedNwcUri
  alias: string
  budgetSats: number
  budgetPeriod: NwcBudgetPeriod
}): NwcConnectionCreateInput => {
  const canPayInvoice = parsedUri.permissions.includes("pay_invoice")

  return {
    nwcUri: parsedUri.raw,
    alias,
    permissions: parsedUri.permissions.map(toNwcGraphqlPermission),
    budgets: canPayInvoice
      ? [
          {
            amountSats: budgetSats,
            period: budgetPeriod,
          },
        ]
      : undefined,
  }
}
