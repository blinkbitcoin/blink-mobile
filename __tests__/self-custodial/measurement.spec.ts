/* eslint-disable camelcase */
import { PaymentMethod } from "@breeztech/breez-sdk-spark-react-native"

import {
  measure,
  measureOnce,
  resetMeasuredOnceKeys,
  resetMeasurementContext,
  scRailForPaymentMethod,
  setMeasurementContext,
  ScEvent,
  ScRail,
} from "@app/self-custodial/measurement"
import { AccountMode } from "@app/types/account"

const mockLogEvent = jest.fn()

jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

describe("measurement gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasurementContext()
  })

  it("emits with the network attached when the active account is Enhanced", () => {
    setMeasurementContext({ mode: AccountMode.Enhanced, network: "regtest" })

    measure(ScEvent.AccountCreated, { flow: "create" })

    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith("sc_account_created", {
      network: "regtest",
      flow: "create",
    })
  })

  it("emits nothing when the active account is Incognito", () => {
    setMeasurementContext({ mode: AccountMode.Anon, network: "mainnet" })

    measure(ScEvent.PaymentSendSettled, { rail: "spark" })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("fails closed when no mode is recorded", () => {
    setMeasurementContext({ mode: null, network: "mainnet" })

    measure(ScEvent.PaymentSendSettled, { rail: "spark" })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("lets onboarding measure against the mode it just wrote, before activation", () => {
    resetMeasurementContext()

    measure(ScEvent.AccountCreated, { flow: "create" }, AccountMode.Enhanced)

    expect(mockLogEvent).toHaveBeenCalledWith("sc_account_created", {
      network: "mainnet",
      flow: "create",
    })
  })

  it("honors an Incognito choice the moment it is made, even over an Enhanced context", () => {
    setMeasurementContext({ mode: AccountMode.Enhanced, network: "mainnet" })

    measure(ScEvent.AccountModeSelected, { mode: "anon" }, AccountMode.Anon)

    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

describe("scRailForPaymentMethod", () => {
  it("maps SDK methods to coarse rails", () => {
    expect(scRailForPaymentMethod(PaymentMethod.Lightning)).toBe(ScRail.Lightning)
    expect(scRailForPaymentMethod(PaymentMethod.Spark)).toBe(ScRail.Spark)
    expect(scRailForPaymentMethod(PaymentMethod.Token)).toBe(ScRail.Spark)
    expect(scRailForPaymentMethod(PaymentMethod.Deposit)).toBe(ScRail.Onchain)
    expect(scRailForPaymentMethod(PaymentMethod.Withdraw)).toBe(ScRail.Onchain)
  })

  it("reports nothing for a method it cannot label", () => {
    expect(scRailForPaymentMethod(PaymentMethod.Unknown)).toBeNull()
  })
})

describe("measureOnce", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasurementContext()
    resetMeasuredOnceKeys()
    setMeasurementContext({ mode: AccountMode.Enhanced, network: "mainnet" })
  })

  it("emits once per key", () => {
    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })
    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })
    measureOnce("p2", ScEvent.PaymentReceived, { rail: ScRail.Lightning })

    expect(mockLogEvent).toHaveBeenCalledTimes(2)
  })

  it("still respects the gate", () => {
    setMeasurementContext({ mode: AccountMode.Anon, network: "mainnet" })

    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})
