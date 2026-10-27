/* eslint-disable camelcase */
import analytics from "@react-native-firebase/analytics"

import { AccountMode } from "@app/types/account"

import type { SparkNetworkLabel } from "./config"

/**
 * The coarse rails reported for self-custodial payments: Lightning lumps BOLT11 and
 * LNURL-pay together, and Lightning Address is a receive-side variant of it. Anything
 * finer (a BOLT11/LNURL-pay split) would still fit this enum, but the destination and
 * the counterparty never do: a rail is a category, never an identifier.
 */
export const ScRail = {
  Lightning: "lightning",
  Spark: "spark",
  Onchain: "onchain",
  LightningAddress: "lightning_address",
} as const

export type ScRail = (typeof ScRail)[keyof typeof ScRail]

/** Every self-custodial telemetry event. New names stay under GA4's 40-character limit
 *  and keep the `sc_` prefix so Enhanced activity is one filter away from custodial's;
 *  the three legacy `self_custodial_*` names predate the gate and keep theirs so
 *  existing dashboards do not break. */
export const ScEvent = {
  AccountCreated: "sc_account_created",
  AccountModeSelected: "sc_account_mode_selected",
  AccountModeChanged: "sc_account_mode_changed",
  LightningAddressRegistered: "sc_lightning_address_registered",
  BackupCompleted: "self_custodial_backup_completed",
  RestoreCompleted: "self_custodial_restore_completed",
  StableBalanceActivated: "self_custodial_stable_balance_activated",
  PaymentDestinationParsed: "sc_payment_destination_parsed",
  PaymentSendInitiated: "sc_payment_send_initiated",
  PaymentSendSettled: "sc_payment_send_settled",
  PaymentSendFailed: "sc_payment_send_failed",
  PaymentRequestCreated: "sc_payment_request_created",
  PaymentReceived: "sc_payment_received",
  SwapQuoteShown: "sc_swap_quote_shown",
  SwapCompleted: "sc_swap_completed",
  SwapFailed: "sc_swap_failed",
  BlinkPaymentSent: "sc_blink_payment_sent",
} as const

export type ScEvent = (typeof ScEvent)[keyof typeof ScEvent]

/** Closed enums and booleans only: never amounts, balances, pubkeys, invoices,
 *  destinations, or free text. */
export type ScEventParams = Record<string, string | number | boolean>

type MeasurementContext = {
  /** The active self-custodial account's mode; null while custodial is active or the
   *  account has not chosen one. */
  mode: AccountMode | null
  network: SparkNetworkLabel
}

let context: MeasurementContext = { mode: null, network: "mainnet" }

/** Refreshed by TelemetryContextMount whenever the active account or instance changes,
 *  so the gate below works from non-React code (bridge, adapters, executors). */
export const setMeasurementContext = (next: MeasurementContext): void => {
  context = next
}

export const resetMeasurementContext = (): void => {
  context = { mode: null, network: "mainnet" }
}

/**
 * The privacy contract's single choke point: an event leaves the device only for an
 * Enhanced account. Incognito suppresses everything, and so does an unset mode — an
 * account that never recorded a choice (restored wallets can hold none) has not
 * consented to the region posture Enhanced implies, so the gate fails closed.
 *
 * `modeOverride` is for onboarding, where the account being measured is not the active
 * one yet: the caller passes the mode it just wrote, and an Anon choice is honored the
 * moment it is made rather than after activation.
 */
export const measure = (
  event: ScEvent,
  params?: ScEventParams,
  modeOverride?: AccountMode | null,
): void => {
  const mode = modeOverride === undefined ? context.mode : modeOverride
  if (mode !== AccountMode.Enhanced) return
  analytics().logEvent(event, { network: context.network, ...params })
}
