import {
  TelemetryEvent,
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
 * the device by reading this file.
 */
export type TelemetryFact =
  | {
      event: typeof TelemetryEvent.PaymentSettled
      telemetryEventId: TelemetryEventId
      walletProvider: WalletProvider
      direction: TelemetryDirection
      railType: RailType
    }
  | {
      event: typeof TelemetryEvent.ConversionSettled
      telemetryEventId: TelemetryEventId
      walletProvider: WalletProvider
      conversionDirection: TelemetryConversionDirection
    }
  | {
      event: typeof TelemetryEvent.ReferralCompleted
      telemetryEventId: TelemetryEventId
      walletProvider: WalletProvider
    }

/** The union's key set, flattened — what a test asserts against the §5.3 allowlist. */
export const TELEMETRY_FACT_KEYS: readonly string[] = [
  "event",
  "telemetryEventId",
  "walletProvider",
  "direction",
  "railType",
  "conversionDirection",
]
