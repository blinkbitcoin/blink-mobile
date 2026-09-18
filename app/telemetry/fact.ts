import {
  TelemetryEvent,
  type BackupMethod,
  type RailType,
  type TelemetryConversionDirection,
  type TelemetryDirection,
  type TelemetryEventId,
  type WalletProvider,
} from "./contract"

/**
 * The only type the boundary accepts (AD-1).
 *
 * Two types in this codebase carry data the contract prohibits: `NormalizedTransaction`
 * (twelve fields, among them `amount`, `fee`, `lnAddress`, `memo` and `timestamp` — the
 * timing-correlation vector §5.6 names explicitly) and the SDK's `Payment` (`amount`,
 * `fees`, `details`, `conversionDetails`, `timestamp`). **Neither may appear in any
 * signature under `app/telemetry/`.**
 *
 * The hazard is prohibited data in *producer* scope, so the projection is the producer's
 * job — see `app/self-custodial/measurement.ts` — and this type is its enforcement. That
 * is also what makes NFR-P5 true: a reviewer can enumerate everything capable of leaving
 * the device by reading this file and `contract.ts`.
 *
 * Q10, answered: one fact type, a discriminated union with one variant per contract row.
 * The legacy events (AD-24) and the loss event (AD-31) fit it without a second type — each
 * variant's keys are the camelCase spelling of its row's parameters, and a test holds the
 * two in lockstep.
 */

type Common = {
  telemetryEventId: TelemetryEventId
  walletProvider: WalletProvider
}

export type TelemetryFact =
  | (Common & {
      event: typeof TelemetryEvent.PaymentSettled
      direction: TelemetryDirection
      railType: RailType
    })
  | (Common & {
      event: typeof TelemetryEvent.ConversionSettled
      conversionDirection: TelemetryConversionDirection
    })
  | (Common & { event: typeof TelemetryEvent.ReferralCompleted })
  | (Common & {
      event: typeof TelemetryEvent.BackupCompleted
      backupMethod: BackupMethod
    })
  | (Common & { event: typeof TelemetryEvent.RestoreCompleted })
  | (Common & {
      event: typeof TelemetryEvent.StableBalanceActivated
      label: "USDB"
    })
  | (Common & {
      event: typeof TelemetryEvent.RolloutExposed
      nonCustodialEnabled: boolean
      stableBalanceEnabled: boolean
      hasCustodialAccount: boolean
    })
  | (Common & {
      event: typeof TelemetryEvent.LossReported
      expired: number
      evicted: number
      rejected: number
      parseFailed: number
    })

/** camelCase → the contract's snake_case wire name. `parseFailed` → `parse_failed`. */
export const wireNameOf = (key: string): string =>
  key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
