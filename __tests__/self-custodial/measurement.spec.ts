/* eslint-disable camelcase */
import { it } from "@jest/globals"
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  measure,
  measureObservedPayment,
  measureOnce,
  measureSettlement,
  resetMeasuredOnceKeys,
  resetMeasurementContext,
  resetSettlementTracking,
  SETTLEMENT_FAILED_CODE,
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

describe("settlement", () => {
  const swap = {
    settled: [{ event: ScEvent.SwapCompleted, params: { direction: "BTCtoUSD" } }],
    failed: { event: ScEvent.SwapFailed, params: { direction: "BTCtoUSD" } },
  }
  const sendPayment = (status: PaymentStatus) => ({
    id: "pay-1",
    status,
    paymentType: PaymentType.Send,
    method: PaymentMethod.Lightning,
  })
  const loggedEvents = () => mockLogEvent.mock.calls.map(([name]) => name)

  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasuredOnceKeys()
    resetSettlementTracking()
    setMeasurementContext({ mode: AccountMode.Enhanced, network: "mainnet" })
  })

  it("reports every settled event of a completed payment at once", () => {
    measureSettlement(
      { id: "pay-1", status: PaymentStatus.Completed },
      {
        settled: [
          { event: ScEvent.PaymentSendSettled },
          { event: ScEvent.BlinkPaymentSent },
        ],
        failed: { event: ScEvent.PaymentSendFailed },
      },
    )

    expect(loggedEvents()).toEqual([ScEvent.PaymentSendSettled, ScEvent.BlinkPaymentSent])
  })

  it("holds a pending swap until the SDK announces it, then reports it once", () => {
    measureSettlement({ id: "pay-1", status: PaymentStatus.Pending }, swap)
    expect(mockLogEvent).not.toHaveBeenCalled()

    measureObservedPayment(sendPayment(PaymentStatus.Pending) as never)
    expect(mockLogEvent).not.toHaveBeenCalled()

    measureObservedPayment(sendPayment(PaymentStatus.Completed) as never)
    measureObservedPayment(sendPayment(PaymentStatus.Completed) as never)
    expect(loggedEvents()).toEqual([ScEvent.SwapCompleted])
  })

  it("reports an announced failure with the settlement code", () => {
    measureSettlement({ id: "pay-1", status: PaymentStatus.Pending }, swap)

    measureObservedPayment(sendPayment(PaymentStatus.Failed) as never)

    expect(mockLogEvent).toHaveBeenCalledWith(ScEvent.SwapFailed, {
      network: "mainnet",
      direction: "BTCtoUSD",
      error_code: SETTLEMENT_FAILED_CODE,
    })
  })

  it("keeps an outcome announced before the payment was handed back", () => {
    measureObservedPayment(sendPayment(PaymentStatus.Failed) as never)

    measureSettlement({ id: "pay-1", status: PaymentStatus.Pending }, swap)

    expect(loggedEvents()).toEqual([ScEvent.SwapFailed])
  })

  it("reports nothing for a payment it was never asked about", () => {
    measureObservedPayment(sendPayment(PaymentStatus.Completed) as never)

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("respects the gate when the outcome arrives", () => {
    measureSettlement({ id: "pay-1", status: PaymentStatus.Pending }, swap)
    setMeasurementContext({ mode: AccountMode.Anon, network: "mainnet" })

    measureObservedPayment(sendPayment(PaymentStatus.Completed) as never)

    expect(mockLogEvent).not.toHaveBeenCalled()
  })
})

describe("observed receives", () => {
  const receive = (status: PaymentStatus, method = PaymentMethod.Spark) =>
    ({ id: "rx-1", status, paymentType: PaymentType.Receive, method }) as never

  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasuredOnceKeys()
    resetSettlementTracking()
    setMeasurementContext({ mode: AccountMode.Enhanced, network: "mainnet" })
  })

  it("counts a completed receive once, on its coarse rail", () => {
    measureObservedPayment(receive(PaymentStatus.Completed, PaymentMethod.Lightning))
    measureObservedPayment(receive(PaymentStatus.Completed, PaymentMethod.Lightning))

    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith(ScEvent.PaymentReceived, {
      network: "mainnet",
      rail: ScRail.Lightning,
    })
  })

  it.each([PaymentStatus.Pending, PaymentStatus.Failed])(
    "does not count a receive in status %s",
    (status) => {
      measureObservedPayment(receive(status))

      expect(mockLogEvent).not.toHaveBeenCalled()
    },
  )
})
