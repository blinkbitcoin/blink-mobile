/* eslint-disable camelcase */
// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import {
  TelemetryEvent,
  RailType,
  TelemetryConversionDirection,
  TelemetryDirection,
  WalletProvider,
} from "@app/telemetry/contract"
import {
  applyPrivacyPolicy,
  getDroppedEventCounts,
  PolicyRejection,
  resetDroppedEventCountsForTesting,
} from "@app/telemetry/policy"

const VALID_EVENT_ID = "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7f8"

type FieldCase = { field: string; value: string | number }

const PROHIBITED_FIELDS: FieldCase[] = [
  { field: "pubkey", value: `02${"a1b2c3d4".repeat(8)}` },
  { field: "account_id", value: "9f8e7d6c-5b4a-4392-8171-605f4e3d2c1b" },
  { field: "payment_hash", value: "a".repeat(64) },
  { field: "amount_sats", value: 21000 },
  { field: "destination", value: "bc1qexampleaddress" },
  { field: "lightning_address", value: "someone@blink.sv" },
]

const DERIVED_EVENT_IDS: { label: string; value: string }[] = [
  { label: "a truncated payment hash", value: "9b74c989" },
  { label: "a base64 digest", value: "m3TJiJusdw/8ApECogDF3g==" },
  { label: "a compressed pubkey", value: `02${"a1b2c3d4".repeat(8)}` },
  { label: "an empty string", value: "" },
]

const UNDECLARED_VALUES: FieldCase[] = [
  { field: "wallet_provider", value: "ledger" },
  { field: "direction", value: "internal" },
  { field: "rail_type", value: "lnurl_pay" },
]

const REQUIRED_PAYMENT_FIELDS: { field: string }[] = [
  { field: "wallet_provider" },
  { field: "direction" },
  { field: "rail_type" },
  { field: "telemetry_event_id" },
  { field: "event_version" },
]

const validPaymentSettled = () => ({
  event_version: 1,
  wallet_provider: WalletProvider.Spark,
  direction: TelemetryDirection.Send,
  rail_type: RailType.Lightning,
  telemetry_event_id: VALID_EVENT_ID,
})

describe("privacy policy stage", () => {
  beforeEach(() => {
    resetDroppedEventCountsForTesting()
  })

  describe("the happy path it is measured against", () => {
    it("permits each event carrying exactly its declared fields", () => {
      expect(
        applyPrivacyPolicy(TelemetryEvent.PaymentSettled, validPaymentSettled()),
      ).toEqual({ permitted: true })

      expect(
        applyPrivacyPolicy(TelemetryEvent.ConversionSettled, {
          event_version: 1,
          wallet_provider: WalletProvider.Spark,
          conversion_direction: TelemetryConversionDirection.UsdToBtc,
          telemetry_event_id: VALID_EVENT_ID,
        }),
      ).toEqual({ permitted: true })

      expect(
        applyPrivacyPolicy(TelemetryEvent.ReferralCompleted, {
          event_version: 1,
          wallet_provider: WalletProvider.Spark,
          telemetry_event_id: VALID_EVENT_ID,
        }),
      ).toEqual({ permitted: true })
    })

    it("counts nothing as dropped while payloads are well formed", () => {
      applyPrivacyPolicy(TelemetryEvent.PaymentSettled, validPaymentSettled())

      expect(getDroppedEventCounts()).toEqual({
        [PolicyRejection.UnknownEvent]: 0,
        [PolicyRejection.UnknownField]: 0,
        [PolicyRejection.MissingField]: 0,
        [PolicyRejection.InvalidValue]: 0,
      })
    })
  })

  describe("FR-7 — a field outside the allowlist drops the event", () => {
    it.each(PROHIBITED_FIELDS)(
      "rejects the prohibited field $field",
      ({ field, value }) => {
        const verdict = applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
          ...validPaymentSettled(),
          [field]: value,
        })

        expect(verdict).toEqual({
          permitted: false,
          rejection: PolicyRejection.UnknownField,
          field,
        })
      },
    )

    it("records the drop locally so a misbehaving classifier is visible", () => {
      applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
        ...validPaymentSettled(),
        pubkey: "02abc",
      })

      expect(getDroppedEventCounts()[PolicyRejection.UnknownField]).toBe(1)
    })

    it("rejects an event name that is not in the contract at all", () => {
      expect(applyPrivacyPolicy("balance_snapshot", {})).toEqual({
        permitted: false,
        rejection: PolicyRejection.UnknownEvent,
      })
    })

    it("rejects a field that is legitimate on a different event", () => {
      // conversion_direction is an approved field — but not on payment_settled, where it
      // has no business being and is therefore unexplained.
      const verdict = applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
        ...validPaymentSettled(),
        conversion_direction: TelemetryConversionDirection.BtcToUsd,
      })

      expect(verdict).toEqual({
        permitted: false,
        rejection: PolicyRejection.UnknownField,
        field: "conversion_direction",
      })
    })
  })

  describe("FR-57 — derivation confers no permissibility", () => {
    it("rejects a hashed identifier smuggled through telemetry_event_id", () => {
      // A sha256 of a pubkey. "It's hashed, so it's anonymous" is the intuition §5.5
      // exists to refuse: a stable transform of a stable identifier is still one.
      const verdict = applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
        ...validPaymentSettled(),
        telemetry_event_id:
          "9b74c9897bac770ffc029102a200c5de3e59d2ceb9e0d7b25b1f0b1c1a1d4e5f",
      })

      expect(verdict).toEqual({
        permitted: false,
        rejection: PolicyRejection.InvalidValue,
        field: "telemetry_event_id",
      })
    })

    it.each(DERIVED_EVENT_IDS)(
      "rejects $label in place of the random id",
      ({ value }) => {
        const verdict = applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
          ...validPaymentSettled(),
          telemetry_event_id: value,
        })

        expect(verdict).toMatchObject({
          permitted: false,
          rejection: PolicyRejection.InvalidValue,
        })
      },
    )

    it("rejects a bucketed amount hidden in rail_type", () => {
      const verdict = applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
        ...validPaymentSettled(),
        rail_type: "lightning_10k_to_100k",
      })

      expect(verdict).toEqual({
        permitted: false,
        rejection: PolicyRejection.InvalidValue,
        field: "rail_type",
      })
    })

    it.each(UNDECLARED_VALUES)(
      "rejects an undeclared value for $field",
      ({ field, value }) => {
        const verdict = applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
          ...validPaymentSettled(),
          [field]: value,
        })

        expect(verdict).toEqual({
          permitted: false,
          rejection: PolicyRejection.InvalidValue,
          field,
        })
      },
    )

    it("rejects a fine rail split that FR-17 has not yet unblocked", () => {
      // Guards CD-5: the four coarse rails are the whole vocabulary at P2, whatever the
      // SDK starts reporting.
      const verdict = applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
        ...validPaymentSettled(),
        rail_type: "bolt11",
      })

      expect(verdict).toMatchObject({ permitted: false, field: "rail_type" })
    })
  })

  describe("a partial event is as much a breach as an extra field", () => {
    it.each(REQUIRED_PAYMENT_FIELDS)(
      "rejects payment_settled missing $field",
      ({ field }) => {
        const payload: Record<string, string | number> = validPaymentSettled()
        delete payload[field]

        expect(applyPrivacyPolicy(TelemetryEvent.PaymentSettled, payload)).toEqual({
          permitted: false,
          rejection: PolicyRejection.MissingField,
          field,
        })
      },
    )

    it("rejects a non-integer event version", () => {
      expect(
        applyPrivacyPolicy(TelemetryEvent.PaymentSettled, {
          ...validPaymentSettled(),
          event_version: "v1",
        }),
      ).toMatchObject({ permitted: false, field: "event_version" })
    })
  })
})
