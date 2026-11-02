/* eslint-disable camelcase */
import { it } from "@jest/globals"
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from "@breeztech/breez-sdk-spark-react-native"

import {
  measure,
  measureFor,
  measureIn,
  measureObservedPayment,
  measureOnce,
  measurementGeneration,
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

/** Whether GA4 is under the Enhanced identity, and the announcement that it now is: the
 *  identity owner's own spec covers how it gets there. */
const mockIdentity = { applied: true }
jest.mock("@app/self-custodial/analytics-identity", () => {
  const listeners: Array<() => void> = []
  return {
    isEnhancedIdentityApplied: () => mockIdentity.applied,
    onEnhancedIdentityApplied: (listener: () => void) => {
      listeners.push(listener)
      return () => undefined
    },
    announceForTest: () => listeners.forEach((listener) => listener()),
  }
})

const announceIdentityApplied = () => {
  mockIdentity.applied = true
  jest.requireMock("@app/self-custodial/analytics-identity").announceForTest()
}

jest.mock("@react-native-firebase/analytics", () => () => ({
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

describe("measurement gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasurementContext()
  })

  it("emits with the network attached when the active account is Enhanced", () => {
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "regtest",
    })

    measure(ScEvent.AccountCreated, { flow: "create" })

    expect(mockLogEvent).toHaveBeenCalledTimes(1)
    expect(mockLogEvent).toHaveBeenCalledWith("sc_account_created", {
      network: "regtest",
      flow: "create",
    })
  })

  it("emits nothing when the active account is Incognito", () => {
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Anon,
      network: "mainnet",
    })

    measure(ScEvent.PaymentSendSettled, { rail: "spark" })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("fails closed when no mode is recorded", () => {
    setMeasurementContext({ accountId: "sc-1", mode: null, network: "mainnet" })

    measure(ScEvent.PaymentSendSettled, { rail: "spark" })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("honors an Incognito choice the moment it is made, even over an Enhanced context", () => {
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })

    measureFor(
      { accountId: "sc-1", mode: AccountMode.Anon },
      ScEvent.AccountModeSelected,
      { mode: "anon" },
    )

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
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
  })

  it("emits once per key", () => {
    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })
    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })
    measureOnce("p2", ScEvent.PaymentReceived, { rail: ScRail.Lightning })

    expect(mockLogEvent).toHaveBeenCalledTimes(2)
  })

  it("still respects the gate", () => {
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Anon,
      network: "mainnet",
    })

    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("leaves the key of a suppressed announcement free for a later one", () => {
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Anon,
      network: "mainnet",
    })
    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })

    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
    measureOnce("p1", ScEvent.PaymentReceived, { rail: ScRail.Spark })

    expect(mockLogEvent).toHaveBeenCalledTimes(1)
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
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
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
      measurementGeneration(),
    )

    expect(loggedEvents()).toEqual([ScEvent.PaymentSendSettled, ScEvent.BlinkPaymentSent])
  })

  it("holds a pending swap until the SDK announces it, then reports it once", () => {
    measureSettlement(
      { id: "pay-1", status: PaymentStatus.Pending },
      swap,
      measurementGeneration(),
    )
    expect(mockLogEvent).not.toHaveBeenCalled()

    measureObservedPayment(sendPayment(PaymentStatus.Pending) as never)
    expect(mockLogEvent).not.toHaveBeenCalled()

    measureObservedPayment(sendPayment(PaymentStatus.Completed) as never)
    measureObservedPayment(sendPayment(PaymentStatus.Completed) as never)
    expect(loggedEvents()).toEqual([ScEvent.SwapCompleted])
  })

  it("reports an announced failure with the settlement code", () => {
    measureSettlement(
      { id: "pay-1", status: PaymentStatus.Pending },
      swap,
      measurementGeneration(),
    )

    measureObservedPayment(sendPayment(PaymentStatus.Failed) as never)

    expect(mockLogEvent).toHaveBeenCalledWith(ScEvent.SwapFailed, {
      network: "mainnet",
      direction: "BTCtoUSD",
      error_code: SETTLEMENT_FAILED_CODE,
    })
  })

  it("keeps an outcome announced before the payment was handed back", () => {
    measureObservedPayment(sendPayment(PaymentStatus.Failed) as never)

    measureSettlement(
      { id: "pay-1", status: PaymentStatus.Pending },
      swap,
      measurementGeneration(),
    )

    expect(loggedEvents()).toEqual([ScEvent.SwapFailed])
  })

  it("reports nothing for a payment it was never asked about", () => {
    measureObservedPayment(sendPayment(PaymentStatus.Completed) as never)

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  it("respects the gate when the outcome arrives", () => {
    measureSettlement(
      { id: "pay-1", status: PaymentStatus.Pending },
      swap,
      measurementGeneration(),
    )
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Anon,
      network: "mainnet",
    })

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
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
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

describe("delivery ownership", () => {
  const enhanced = (accountId: string) =>
    setMeasurementContext({ accountId, mode: AccountMode.Enhanced, network: "mainnet" })
  const loggedEvents = () => mockLogEvent.mock.calls.map(([name]) => name)

  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasuredOnceKeys()
    resetMeasurementContext()
    mockIdentity.applied = true
    mockLogEvent.mockImplementation(() => Promise.resolve())
  })

  afterAll(() => {
    mockIdentity.applied = true
  })

  describe("context events", () => {
    it("wait for the Enhanced identity, then go out once", () => {
      enhanced("sc-a")
      mockIdentity.applied = false

      measure(ScEvent.LightningAddressRegistered)
      expect(mockLogEvent).not.toHaveBeenCalled()

      announceIdentityApplied()
      announceIdentityApplied()

      expect(loggedEvents()).toEqual([ScEvent.LightningAddressRegistered])
    })

    it("never go out under the next Enhanced account", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      measure(ScEvent.LightningAddressRegistered)

      enhanced("sc-b")
      announceIdentityApplied()

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("are dropped when the context passes through custodial on the way to another account", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      measure(ScEvent.LightningAddressRegistered)

      resetMeasurementContext()
      enhanced("sc-b")
      announceIdentityApplied()

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("from a transition that never completed do not ride on a later account's", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      measure(ScEvent.LightningAddressRegistered)

      /** The transition for sc-a failed: no announcement. The user moves on to sc-b,
       *  whose transition succeeds. */
      enhanced("sc-b")
      announceIdentityApplied()
      measure(ScEvent.LightningAddressRegistered, { rail: "b" })

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledWith(ScEvent.LightningAddressRegistered, {
        network: "mainnet",
        rail: "b",
      })
    })

    it("are dropped after waiting too long", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000)
      measure(ScEvent.LightningAddressRegistered)

      nowSpy.mockReturnValue(1_000_000 + 6 * 60 * 1000)
      announceIdentityApplied()
      nowSpy.mockRestore()

      expect(mockLogEvent).not.toHaveBeenCalled()
    })
  })

  describe("onboarding events", () => {
    const forAccount = (mode: AccountMode | null) =>
      measureFor({ accountId: "sc-new", mode }, ScEvent.AccountCreated, {
        flow: "create",
      })

    it("wait for their account to be active under Enhanced", () => {
      forAccount(AccountMode.Enhanced)
      enhanced("sc-other")
      expect(mockLogEvent).not.toHaveBeenCalled()

      enhanced("sc-new")

      expect(loggedEvents()).toEqual([ScEvent.AccountCreated])
    })

    it("wait for their own account even while another is active under Enhanced", () => {
      enhanced("sc-other")

      forAccount(AccountMode.Enhanced)
      expect(mockLogEvent).not.toHaveBeenCalled()

      enhanced("sc-new")
      expect(loggedEvents()).toEqual([ScEvent.AccountCreated])
    })

    it("keep waiting while their account has no mode yet", () => {
      forAccount(AccountMode.Enhanced)
      setMeasurementContext({ accountId: "sc-new", mode: null, network: "mainnet" })
      expect(mockLogEvent).not.toHaveBeenCalled()

      enhanced("sc-new")

      expect(loggedEvents()).toEqual([ScEvent.AccountCreated])
    })

    it("are dropped if their account turns out Incognito", () => {
      forAccount(AccountMode.Enhanced)
      setMeasurementContext({
        accountId: "sc-new",
        mode: AccountMode.Anon,
        network: "mainnet",
      })
      enhanced("sc-new")

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("go out at once for the account already active under Enhanced", () => {
      enhanced("sc-new")

      forAccount(AccountMode.Enhanced)

      expect(loggedEvents()).toEqual([ScEvent.AccountCreated])
    })

    it("are dropped if their account is not activated in time", () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000)
      forAccount(AccountMode.Enhanced)

      nowSpy.mockReturnValue(1_000_000 + 6 * 60 * 1000)
      enhanced("sc-new")
      nowSpy.mockRestore()

      expect(mockLogEvent).not.toHaveBeenCalled()
    })
  })

  describe("operations that end in another context", () => {
    it("report nothing", () => {
      enhanced("sc-a")
      const startedIn = measurementGeneration()

      enhanced("sc-b")

      expect(measureIn(startedIn, ScEvent.PaymentSendFailed)).toBe(false)
      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("report in the context they began in", () => {
      enhanced("sc-a")

      expect(measureIn(measurementGeneration(), ScEvent.PaymentSendFailed)).toBe(true)
      expect(loggedEvents()).toEqual([ScEvent.PaymentSendFailed])
    })
  })

  describe("dedupe keys", () => {
    const announce = () =>
      measureOnce("rx-1", ScEvent.PaymentReceived, { rail: ScRail.Spark })
    const flush = async () => {
      await Promise.resolve()
      await Promise.resolve()
    }

    it("are used up by an event GA4 accepted", async () => {
      enhanced("sc-a")
      announce()
      await flush()
      announce()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })

    it("are held while the event waits, so a repeat does not queue twice", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      announce()
      announce()

      announceIdentityApplied()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })

    it("are freed when the waiting event is dropped with its context", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      announce()
      enhanced("sc-b")
      announceIdentityApplied()

      announce()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })

    it("are freed when the waiting event expires", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1_000_000)
      announce()
      nowSpy.mockReturnValue(1_000_000 + 6 * 60 * 1000)
      announceIdentityApplied()
      nowSpy.mockRestore()

      announce()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })

    it("are freed when the waiting event is evicted by newer ones", () => {
      enhanced("sc-a")
      mockIdentity.applied = false
      announce()
      for (let i = 0; i < 50; i += 1) measure(ScEvent.LightningAddressRegistered)
      announceIdentityApplied()
      jest.clearAllMocks()

      announce()

      expect(loggedEvents()).toEqual([ScEvent.PaymentReceived])
    })

    it("are freed when GA4 rejects the event", async () => {
      enhanced("sc-a")
      mockLogEvent.mockImplementationOnce(() => Promise.reject(new Error("native")))
      announce()
      await flush()

      announce()

      expect(mockLogEvent).toHaveBeenCalledTimes(2)
    })
  })
})
