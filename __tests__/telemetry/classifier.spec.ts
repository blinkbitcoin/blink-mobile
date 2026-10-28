// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import {
  PaymentMethod,
  PaymentType as SdkPaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  classifyConversionDirection,
  classifyDirection,
  classifyRail,
} from "@app/telemetry/classifier"
import {
  RailType,
  TelemetryConversionDirection,
  TelemetryDirection,
} from "@app/telemetry/contract"

describe("classifyRail", () => {
  it.each([
    { method: PaymentMethod.Lightning, expected: RailType.Lightning },
    { method: PaymentMethod.Spark, expected: RailType.Spark },
    { method: PaymentMethod.Deposit, expected: RailType.Onchain },
    { method: PaymentMethod.Withdraw, expected: RailType.Onchain },
    { method: PaymentMethod.Token, expected: RailType.Spark },
    { method: PaymentMethod.Unknown, expected: RailType.Unknown },
  ])("reads $method as $expected", ({ method, expected }) => {
    expect(classifyRail(method)).toBe(expected)
  })

  it("reads a method this build has never heard of as unknown, rather than guessing", () => {
    expect(classifyRail("something-new" as unknown as PaymentMethod)).toBe(
      RailType.Unknown,
    )
  })
})

describe("classifyDirection", () => {
  it("reads a send as a send and a receive as a receive", () => {
    expect(classifyDirection(SdkPaymentType.Send)).toBe(TelemetryDirection.Send)
    expect(classifyDirection(SdkPaymentType.Receive)).toBe(TelemetryDirection.Receive)
  })

  it("refuses a payment it cannot place, so nothing is counted in the wrong direction", () => {
    expect(classifyDirection("sideways" as unknown as SdkPaymentType)).toBeNull()
  })
})

describe("classifyConversionDirection", () => {
  it("reads dollars in, bitcoin out as a dollar-to-bitcoin swap", () => {
    expect(classifyConversionDirection({ fromIsBitcoin: false, toIsBitcoin: true })).toBe(
      TelemetryConversionDirection.UsdToBtc,
    )
  })

  it("reads bitcoin in, dollars out as a bitcoin-to-dollar swap", () => {
    expect(classifyConversionDirection({ fromIsBitcoin: true, toIsBitcoin: false })).toBe(
      TelemetryConversionDirection.BtcToUsd,
    )
  })

  it("refuses a swap with the same kind of asset on both ends", () => {
    // A bitcoin-to-bitcoin or token-to-token movement is not a dollar swap, and guessing
    // a direction for it would put a real count in the wrong bucket.
    expect(
      classifyConversionDirection({ fromIsBitcoin: true, toIsBitcoin: true }),
    ).toBeNull()
    expect(
      classifyConversionDirection({ fromIsBitcoin: false, toIsBitcoin: false }),
    ).toBeNull()
  })
})
