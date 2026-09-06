/* eslint-disable camelcase */
// See policy.spec.ts — the mocha types in tsconfig shadow Jest's `it`.
import { it } from "@jest/globals"

import {
  PaymentMethod,
  PaymentStatus,
  PaymentType as SdkPaymentType,
  type Payment,
} from "@breeztech/breez-sdk-spark-react-native"
import analytics from "@react-native-firebase/analytics"
import Crypto from "react-native-quick-crypto"

import {
  logConversionSettled,
  logPaymentSettled,
  logReferralCompleted,
} from "@app/self-custodial/measurement"
import {
  initializeTelemetryGate,
  isCollectionPermitted,
  isSelfCustodialTelemetryPermitted,
  onTelemetrySuppressed,
  resolveTelemetryMode,
  resetTelemetryGateForTesting,
  TelemetryMode,
} from "@app/self-custodial/measurement/gate"
import { resetTelemetryEventIdsForTesting } from "@app/self-custodial/measurement/event-id"
import { ConvertDirection } from "@app/types/payment"

const logEvent = analytics().logEvent as jest.Mock
const setCollectionEnabled = analytics().setAnalyticsCollectionEnabled as jest.Mock
const randomUUID = Crypto.randomUUID as jest.Mock

const payment = (overrides: Partial<Payment> = {}): Payment =>
  ({
    id: "sdk-payment-1",
    paymentType: SdkPaymentType.Receive,
    status: PaymentStatus.Completed,
    amount: 21000n,
    fees: 1n,
    timestamp: 1757203200n,
    method: PaymentMethod.Lightning,
    details: undefined,
    conversionDetails: undefined,
    ...overrides,
  }) as Payment

/** Every negative assertion below is checked against this, so "nothing was emitted" can
 *  never pass because the call site was silently broken. */
const enhancedEmits = (): number => {
  resolveTelemetryMode(TelemetryMode.Enhanced)
  logPaymentSettled(payment({ id: `control-${Math.random()}` }))
  return logEvent.mock.calls.length
}

describe("the telemetry privacy boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetTelemetryGateForTesting()
    resetTelemetryEventIdsForTesting()
    // clearAllMocks only clears call records — a mockReturnValueOnce left unconsumed by
    // an earlier test would otherwise be handed to this one.
    randomUUID.mockReset()
    randomUUID.mockReturnValue("00000000-0000-4000-8000-000000000000")
  })

  describe("FR-9 suppression matrix", () => {
    it("cold start: emits nothing before a mode is resolved", () => {
      initializeTelemetryGate()

      logPaymentSettled(payment())
      logConversionSettled({ direction: ConvertDirection.BtcToUsd, sdkPaymentId: "p" })
      logReferralCompleted({ sdkPaymentId: "p" })

      expect(logEvent).not.toHaveBeenCalled()
      // Anchor: the very same calls do land once the mode resolves, so the silence above
      // is the gate's doing and not a dead call site.
      expect(enhancedEmits()).toBe(1)
    })

    it("cold start: disables collection at process start", () => {
      initializeTelemetryGate()

      expect(setCollectionEnabled).toHaveBeenCalledWith(false)
      expect(isCollectionPermitted()).toBe(false)
    })

    it("restore from backup: an account with no resolved mode stays silent", () => {
      // Restore activates the account before the mode screen and never resumes onto it, so
      // a fully onboarded account can legitimately hold no mode. The UI reads that as
      // Enhanced; §5.7 does not.
      initializeTelemetryGate()
      resolveTelemetryMode(TelemetryMode.Unresolved)

      logPaymentSettled(payment())

      expect(logEvent).not.toHaveBeenCalled()
      expect(enhancedEmits()).toBe(1)
    })

    it("account switching: falls silent when Enhanced gives way to incognito", () => {
      resolveTelemetryMode(TelemetryMode.Enhanced)
      logPaymentSettled(payment({ id: "before-switch" }))
      expect(logEvent).toHaveBeenCalledTimes(1)

      resolveTelemetryMode(TelemetryMode.Incognito)
      logPaymentSettled(payment({ id: "after-switch" }))

      expect(logEvent).toHaveBeenCalledTimes(1)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)
    })

    it("account switching: resumes when incognito gives way to Enhanced", () => {
      resolveTelemetryMode(TelemetryMode.Incognito)
      logPaymentSettled(payment({ id: "while-incognito" }))
      expect(logEvent).not.toHaveBeenCalled()

      resolveTelemetryMode(TelemetryMode.Enhanced)
      logPaymentSettled(payment({ id: "after-switch" }))

      expect(logEvent).toHaveBeenCalledTimes(1)
    })

    it("offline start and failed LNURL mode recovery: silence, never a fallback to enabled", () => {
      // Both failures reach the gate the same way — as an absent mode. There is no third
      // state that means "assume Enhanced".
      initializeTelemetryGate()
      resolveTelemetryMode(TelemetryMode.Unresolved)

      logPaymentSettled(payment())

      expect(isSelfCustodialTelemetryPermitted()).toBe(false)
      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
      expect(logEvent).not.toHaveBeenCalled()
      expect(enhancedEmits()).toBe(1)
    })

    it("resolution race: an event arriving before the mode does is dropped, not buffered", () => {
      initializeTelemetryGate()

      logPaymentSettled(payment({ id: "raced" }))
      expect(logEvent).not.toHaveBeenCalled()

      resolveTelemetryMode(TelemetryMode.Enhanced)

      // The dropped event does not reappear once the gate opens: it was never held.
      expect(logEvent).not.toHaveBeenCalled()
      expect(enhancedEmits()).toBe(1)
    })
  })

  describe("FR-4 and FR-5 — discard before disabling, never flush then discard", () => {
    it("notifies suppression listeners when Enhanced switches to incognito", () => {
      const discard = jest.fn()
      onTelemetrySuppressed(discard)
      resolveTelemetryMode(TelemetryMode.Enhanced)

      resolveTelemetryMode(TelemetryMode.Incognito)

      expect(discard).toHaveBeenCalledTimes(1)
    })

    it("discards before collection is disabled, so nothing queued can be flushed", () => {
      const order: string[] = []
      onTelemetrySuppressed(() => order.push("discard"))
      setCollectionEnabled.mockImplementation(() => {
        order.push("disable")
        return Promise.resolve()
      })
      resolveTelemetryMode(TelemetryMode.Enhanced)
      order.length = 0

      resolveTelemetryMode(TelemetryMode.Incognito)

      expect(order).toEqual(["discard", "disable"])
    })

    it("does not re-notify when incognito is resolved twice", () => {
      const discard = jest.fn()
      onTelemetrySuppressed(discard)
      resolveTelemetryMode(TelemetryMode.Incognito)
      discard.mockClear()

      resolveTelemetryMode(TelemetryMode.Incognito)

      expect(discard).not.toHaveBeenCalled()
      // Anchor: a real transition still notifies, so the silence is idempotence.
      resolveTelemetryMode(TelemetryMode.Enhanced)
      resolveTelemetryMode(TelemetryMode.Incognito)
      expect(discard).toHaveBeenCalledTimes(1)
    })
  })

  describe("FR-19 — mode mislabelling is as severe as a leak", () => {
    it("emits no Spark-tagged event while the active account is custodial", () => {
      resolveTelemetryMode(TelemetryMode.Custodial)

      logPaymentSettled(payment())
      logConversionSettled({ direction: ConvertDirection.UsdToBtc, sdkPaymentId: "p" })

      expect(logEvent).not.toHaveBeenCalled()
      expect(enhancedEmits()).toBe(1)
    })

    it("still permits custodial analytics collection generally", () => {
      // Custodial is measured as it always was; it just may not produce Spark events.
      resolveTelemetryMode(TelemetryMode.Custodial)

      expect(isCollectionPermitted()).toBe(true)
      expect(isSelfCustodialTelemetryPermitted()).toBe(false)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(true)
    })

    it("tags every self-custodial event as spark", () => {
      resolveTelemetryMode(TelemetryMode.Enhanced)

      logPaymentSettled(payment())
      logConversionSettled({ direction: ConvertDirection.UsdToBtc, sdkPaymentId: "c" })
      logReferralCompleted({ sdkPaymentId: "r" })

      for (const [, payload] of logEvent.mock.calls) {
        expect(payload.wallet_provider).toBe("spark")
      }
      expect(logEvent).toHaveBeenCalledTimes(3)
    })
  })
})
