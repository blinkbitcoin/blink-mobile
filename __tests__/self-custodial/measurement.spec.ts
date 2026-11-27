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
  resetBandingPrice,
  resetSettlementTracking,
  setBandingPrice,
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

describe("amount bucket", () => {
  const USDB = "btkn1usdb"
  const send = { rail: ScRail.Bolt11, sending_wallet: "BTC" }
  const sendTelemetry = {
    settled: [
      { event: ScEvent.PaymentSendSettled, params: send },
      { event: ScEvent.BlinkPaymentSent, params: send },
    ],
    failed: { event: ScEvent.PaymentSendFailed, params: send },
  }
  const swapTelemetry = {
    settled: [{ event: ScEvent.SwapCompleted, params: { direction: "BTCtoUSD" } }],
    failed: { event: ScEvent.SwapFailed, params: { direction: "BTCtoUSD" } },
  }
  const sentPayment = (status: PaymentStatus, amount?: bigint) => ({
    id: "pay-1",
    status,
    paymentType: PaymentType.Send,
    method: PaymentMethod.Lightning,
    ...(amount === undefined ? {} : { amount }),
  })
  const receivedUsdb = (usd: number) =>
    ({
      id: "rx-usdb",
      status: PaymentStatus.Completed,
      paymentType: PaymentType.Receive,
      method: PaymentMethod.Token,
      amount: BigInt(usd * 1_000_000),
      details: { tag: "Token", inner: { metadata: { identifier: USDB, decimals: 6 } } },
    }) as never
  const paramsOf = (event: ScEvent) =>
    mockLogEvent.mock.calls.find(([name]) => name === event)?.[1]

  beforeEach(() => {
    jest.clearAllMocks()
    resetMeasuredOnceKeys()
    resetSettlementTracking()
    resetBandingPrice()
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Enhanced,
      network: "mainnet",
    })
  })

  it("rides on a completed send's settle, and only there", () => {
    measureSettlement(
      sentPayment(PaymentStatus.Completed, 25_000n),
      sendTelemetry,
      measurementGeneration(),
    )

    expect(paramsOf(ScEvent.PaymentSendSettled)).toEqual({
      network: "mainnet",
      ...send,
      amount_bucket: "10k_100k",
    })
    expect(paramsOf(ScEvent.BlinkPaymentSent)).toEqual({ network: "mainnet", ...send })
  })

  it("is not added to a failed send", () => {
    measureSettlement(
      sentPayment(PaymentStatus.Failed, 25_000n),
      sendTelemetry,
      measurementGeneration(),
    )

    expect(paramsOf(ScEvent.PaymentSendFailed)).toEqual({
      network: "mainnet",
      ...send,
      error_code: SETTLEMENT_FAILED_CODE,
    })
  })

  it("is not added to a swap", () => {
    measureSettlement(
      sentPayment(PaymentStatus.Completed, 25_000n),
      swapTelemetry,
      measurementGeneration(),
    )

    expect(paramsOf(ScEvent.SwapCompleted)).toEqual({
      network: "mainnet",
      direction: "BTCtoUSD",
    })
  })

  it("is taken from the SDK's announcement when a pending send settles later", () => {
    measureSettlement(
      sentPayment(PaymentStatus.Pending),
      sendTelemetry,
      measurementGeneration(),
    )
    measureObservedPayment(sentPayment(PaymentStatus.Completed, 500n) as never)

    expect(paramsOf(ScEvent.PaymentSendSettled)).toMatchObject({
      amount_bucket: "under_1k",
    })
  })

  it("survives an announcement that arrives before the send is handed back", () => {
    measureObservedPayment(sentPayment(PaymentStatus.Completed, 150_000n) as never)
    measureSettlement(
      sentPayment(PaymentStatus.Pending),
      sendTelemetry,
      measurementGeneration(),
    )

    expect(paramsOf(ScEvent.PaymentSendSettled)).toMatchObject({
      amount_bucket: "over_100k",
    })
  })

  it("falls back to the handed-back payment when the announcement had no amount", () => {
    measureObservedPayment(sentPayment(PaymentStatus.Completed) as never)
    measureSettlement(
      sentPayment(PaymentStatus.Pending, 2_000n),
      sendTelemetry,
      measurementGeneration(),
    )

    expect(paramsOf(ScEvent.PaymentSendSettled)).toMatchObject({
      amount_bucket: "1k_10k",
    })
  })

  it("is left out when the payment's size cannot be told", () => {
    measureSettlement(
      sentPayment(PaymentStatus.Completed),
      sendTelemetry,
      measurementGeneration(),
    )

    expect(paramsOf(ScEvent.PaymentSendSettled)).toEqual({ network: "mainnet", ...send })
  })

  it("rides on a completed receive", () => {
    measureObservedPayment({
      id: "rx-1",
      status: PaymentStatus.Completed,
      paymentType: PaymentType.Receive,
      method: PaymentMethod.Lightning,
      amount: 1_000n,
    } as never)

    expect(paramsOf(ScEvent.PaymentReceived)).toEqual({
      network: "mainnet",
      rail: ScRail.Lightning,
      amount_bucket: "1k_10k",
    })
  })

  it("bands a dollar receive at the held price", () => {
    setBandingPrice({ usdPerBtc: 100_000, usdTokenIdentifier: USDB })

    measureObservedPayment(receivedUsdb(20))

    expect(paramsOf(ScEvent.PaymentReceived)).toEqual({
      network: "mainnet",
      rail: ScRail.Spark,
      amount_bucket: "10k_100k",
    })
  })

  it("sends a dollar receive without a band when no price is held", () => {
    measureObservedPayment(receivedUsdb(20))

    expect(paramsOf(ScEvent.PaymentReceived)).toEqual({
      network: "mainnet",
      rail: ScRail.Spark,
    })
  })

  it("sends nothing at all in Incognito", () => {
    setMeasurementContext({
      accountId: "sc-1",
      mode: AccountMode.Anon,
      network: "mainnet",
    })

    measureSettlement(
      sentPayment(PaymentStatus.Completed, 25_000n),
      sendTelemetry,
      measurementGeneration(),
    )
    measureObservedPayment(receivedUsdb(20))

    expect(mockLogEvent).not.toHaveBeenCalled()
  })

  /** The privacy contract, as a property of every payload: only allowlisted keys, and the
   *  amount itself nowhere, in any form. */
  it("never puts the amount in any event", () => {
    const amounts = [123_456n, 25_000n, 999n]
    setBandingPrice({ usdPerBtc: 100_000, usdTokenIdentifier: USDB })

    measureSettlement(
      { ...sentPayment(PaymentStatus.Completed, amounts[0]), id: "a" },
      sendTelemetry,
      measurementGeneration(),
    )
    measureSettlement(
      { ...sentPayment(PaymentStatus.Pending), id: "b" },
      sendTelemetry,
      measurementGeneration(),
    )
    measureObservedPayment({
      ...sentPayment(PaymentStatus.Completed, amounts[1]),
      id: "b",
    } as never)
    measureObservedPayment({
      id: "c",
      status: PaymentStatus.Completed,
      paymentType: PaymentType.Receive,
      method: PaymentMethod.Spark,
      amount: amounts[2],
    } as never)
    measureObservedPayment(receivedUsdb(20))

    const allowed = new Set([
      "network",
      "rail",
      "sending_wallet",
      "amount_bucket",
      "error_code",
    ])
    const forbidden = [...amounts.map(String), "20", "20000000"]
    /** Two sends (each with its referral event) and two receives. */
    expect(mockLogEvent).toHaveBeenCalledTimes(6)
    mockLogEvent.mock.calls.forEach(([, payload]) => {
      Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
        expect(allowed).toContain(key)
        forbidden.forEach((amount) => expect(String(value)).not.toContain(amount))
      })
    })
  })
})
