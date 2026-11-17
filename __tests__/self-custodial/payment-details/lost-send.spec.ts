import { it } from "@jest/globals"
import { ConversionStatus, PaymentStatus } from "@breeztech/breez-sdk-spark-react-native"

import {
  findLostConversion,
  isPaymentOfLostConversion,
  markReceivedHistory,
} from "@app/self-custodial/payment-details/lost-send"

const mockReportError = jest.fn()
jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

const MARK_SEC = 1_747_691_078
const RECEIVE = 1

/** What the lost conversion was quoted to deliver: dollars, in token base units. */
const QUOTED_OUT = 1_370_000
const DOLLAR_TOKEN = "usdb-token-id"

type DeliveryShape = {
  id?: string
  timestamp?: number
  amount?: number
  tag?: "Token" | "Spark"
  provider?: "Amm" | "Orchestra"
  purpose?: "SelfTransfer" | "AutoConversion" | "OngoingPayment"
  legStatus?: ConversionStatus
  overallStatus?: ConversionStatus
  paymentStatus?: PaymentStatus
}

/**
 * What the SDK (0.27.1) lists for a conversion this app makes by paying the wallet's own
 * invoice: the payment the swap delivered, recorded with the conversion it is a leg of
 * and that conversion's purpose. Bitcoin to dollars delivers a token payment, dollars to
 * bitcoin a Spark one. The invoice itself is on none of it.
 */
const delivery = ({
  id = "rcv-conversion",
  timestamp = MARK_SEC + 5,
  amount = QUOTED_OUT,
  tag = "Token",
  provider = "Amm",
  purpose = "SelfTransfer",
  legStatus = ConversionStatus.Completed,
  overallStatus,
  paymentStatus = PaymentStatus.Completed,
}: DeliveryShape = {}) => ({
  id,
  timestamp: BigInt(timestamp),
  amount: BigInt(amount),
  status: paymentStatus,
  paymentType: RECEIVE,
  details: {
    tag,
    inner: {
      invoiceDetails: undefined,
      metadata: { identifier: DOLLAR_TOKEN },
      conversionInfo: {
        tag: provider,
        inner: {
          poolId: "pool",
          conversionId: "conversion",
          status: legStatus,
          fee: undefined,
          purpose: { tag: purpose },
        },
      },
    },
  },
  conversionDetails:
    overallStatus === undefined ? undefined : { status: overallStatus, conversions: [] },
})

/** A payment received from someone, no leg of any conversion: sats by default. */
const received = (
  id: string,
  timestamp = MARK_SEC + 5,
  {
    tag = "Spark",
    amount = 2100,
    token = DOLLAR_TOKEN,
  }: { tag?: "Spark" | "Token"; amount?: number; token?: string } = {},
) => ({
  id,
  timestamp: BigInt(timestamp),
  amount: BigInt(amount),
  status: PaymentStatus.Completed,
  paymentType: RECEIVE,
  details: {
    tag,
    inner: {
      invoiceDetails: undefined,
      htlcDetails: undefined,
      metadata: { identifier: token },
    },
  },
  conversionDetails: undefined,
})

/** A conversion to dollars lost after the received payments were marked. */
const LOST = {
  walletClockSec: MARK_SEC,
  knownPaymentIds: ["rcv-before"],
  expectedDeliveries: [
    { tokenIdentifier: DOLLAR_TOKEN, amount: QUOTED_OUT, isAutomatic: false },
  ],
  lastAttemptAtMs: (MARK_SEC + 1) * 1000,
}

describe("isPaymentOfLostConversion", () => {
  it("takes what an own conversion delivered after the mark", () => {
    expect(isPaymentOfLostConversion(LOST, delivery() as never)).toBe(true)
  })

  it("takes a conversion to bitcoin, whose delivery is a Spark payment", () => {
    expect(isPaymentOfLostConversion(LOST, delivery({ tag: "Spark" }) as never)).toBe(
      true,
    )
  })

  it("takes one made at the mark's second that the mark did not know", () => {
    const atMark = delivery({ id: "rcv-new", timestamp: MARK_SEC })

    expect(isPaymentOfLostConversion(LOST, atMark as never)).toBe(true)
  })

  it("passes over a payment the mark knew", () => {
    const known = delivery({ id: "rcv-before", timestamp: MARK_SEC })

    expect(isPaymentOfLostConversion(LOST, known as never)).toBe(false)
  })

  it("passes over a conversion received before the mark", () => {
    const older = delivery({ timestamp: MARK_SEC - 1 })

    expect(isPaymentOfLostConversion(LOST, older as never)).toBe(false)
  })

  it("passes over the Stable Balance's own conversions", () => {
    const sweep = delivery({ purpose: "AutoConversion" })

    expect(isPaymentOfLostConversion(LOST, sweep as never)).toBe(false)
  })

  it("passes over a conversion made to pay someone else", () => {
    const ongoing = delivery({ purpose: "OngoingPayment" })

    expect(isPaymentOfLostConversion(LOST, ongoing as never)).toBe(false)
  })

  it("passes over a conversion leg with no purpose recorded", () => {
    const unknownPurpose = delivery()
    unknownPurpose.details.inner.conversionInfo.inner.purpose = undefined as unknown as {
      tag: "SelfTransfer"
    }

    expect(isPaymentOfLostConversion(LOST, unknownPurpose as never)).toBe(false)
  })

  it("passes over a conversion another provider made", () => {
    const bridged = delivery({ provider: "Orchestra" })

    expect(isPaymentOfLostConversion(LOST, bridged as never)).toBe(false)
  })

  it("passes over a payment that is no leg of a conversion", () => {
    expect(isPaymentOfLostConversion(LOST, received("rcv-friend") as never)).toBe(false)
  })

  it("passes over a payment without details", () => {
    const bare = { ...received("rcv-bare"), details: undefined }

    expect(isPaymentOfLostConversion(LOST, bare as never)).toBe(false)
  })

  /** The SDK labels a delivery as its conversion's once its own call to the pool
   *  answers; one whose answer was lost comes in unlabeled until it finds the swap ran. */
  it("takes a payment not labeled yet that delivers what the conversion was quoted to", () => {
    const unlabeled = received("rcv-unlabeled", MARK_SEC + 5, {
      tag: "Token",
      amount: QUOTED_OUT,
    })

    expect(isPaymentOfLostConversion(LOST, unlabeled as never)).toBe(true)
  })

  /** Slippage caps a worse price; a better one between the quote and the swap has no cap
   *  but the one the look sets. */
  it("takes an unlabeled delivery a little below the quote, or well above it, no further", () => {
    /** 1 % below 1,370,000 is 1,356,300; 10 % above it, 1,507,000. */
    const unlabeled = (id: string, amount: number) =>
      received(id, MARK_SEC + 5, { tag: "Token", amount }) as never

    expect(isPaymentOfLostConversion(LOST, unlabeled("rcv-low", 1_356_300))).toBe(true)
    expect(isPaymentOfLostConversion(LOST, unlabeled("rcv-high", 1_507_000))).toBe(true)
    expect(isPaymentOfLostConversion(LOST, unlabeled("rcv-lower", 1_356_299))).toBe(false)
    expect(isPaymentOfLostConversion(LOST, unlabeled("rcv-higher", 1_507_001))).toBe(
      false,
    )
  })

  it("passes over an unlabeled payment of another token", () => {
    const otherToken = received("rcv-other", MARK_SEC + 5, {
      tag: "Token",
      amount: QUOTED_OUT,
      token: "another-token",
    })

    expect(isPaymentOfLostConversion(LOST, otherToken as never)).toBe(false)
  })

  it("passes over an unlabeled payment of the other asset", () => {
    const sats = received("rcv-sats", MARK_SEC + 5, { tag: "Spark", amount: QUOTED_OUT })

    expect(isPaymentOfLostConversion(LOST, sats as never)).toBe(false)
  })

  it("takes an unlabeled Spark payment for a conversion to bitcoin", () => {
    const toBitcoin = {
      ...LOST,
      expectedDeliveries: [{ amount: 5000, isAutomatic: false }],
    }
    const sats = received("rcv-sats", MARK_SEC + 5, { tag: "Spark", amount: 5000 })

    expect(isPaymentOfLostConversion(toBitcoin, sats as never)).toBe(true)
  })

  it("passes over an unlabeled payment the mark knew or that came before it", () => {
    const known = received("rcv-before", MARK_SEC, { tag: "Token", amount: QUOTED_OUT })
    const older = received("rcv-older", MARK_SEC - 1, {
      tag: "Token",
      amount: QUOTED_OUT,
    })

    expect(isPaymentOfLostConversion(LOST, known as never)).toBe(false)
    expect(isPaymentOfLostConversion(LOST, older as never)).toBe(false)
  })

  it("does not take a labeled leg of another conversion for an unlabeled delivery", () => {
    const sweep = delivery({ purpose: "AutoConversion", amount: QUOTED_OUT })

    expect(isPaymentOfLostConversion(LOST, sweep as never)).toBe(false)
  })

  it("takes a conversion still delivering", () => {
    const pending = delivery({ legStatus: ConversionStatus.Pending })

    expect(isPaymentOfLostConversion(LOST, pending as never)).toBe(true)
  })

  it.each([
    ["failed", ConversionStatus.Failed],
    ["owed a refund", ConversionStatus.RefundNeeded],
    ["refunded", ConversionStatus.Refunded],
  ])("passes over the refund of a conversion that %s", (_, legStatus) => {
    expect(isPaymentOfLostConversion(LOST, delivery({ legStatus }) as never)).toBe(false)
  })

  it("goes by the conversion's overall status when the wallet has it", () => {
    const refunded = delivery({
      legStatus: ConversionStatus.Completed,
      overallStatus: ConversionStatus.Refunded,
    })
    const delivered = delivery({
      legStatus: ConversionStatus.Pending,
      overallStatus: ConversionStatus.Completed,
    })

    expect(isPaymentOfLostConversion(LOST, refunded as never)).toBe(false)
    expect(isPaymentOfLostConversion(LOST, delivered as never)).toBe(true)
  })
})

describe("markReceivedHistory", () => {
  it("reads the newest payments received, from the start of the history", async () => {
    const listPayments = jest.fn().mockResolvedValue({ payments: [] })

    await markReceivedHistory({ listPayments } as never)

    expect(listPayments).toHaveBeenCalledWith({
      typeFilter: [RECEIVE],
      statusFilter: undefined,
      assetFilter: undefined,
      paymentDetailsFilter: undefined,
      fromTimestamp: 0n,
      toTimestamp: undefined,
      offset: 0,
      limit: 50,
      sortAscending: false,
    })
  })

  const NOW_SEC = 1_800_000_000
  const DAY = 24 * 60 * 60
  const markAt = (payments: ReadonlyArray<unknown>, nowSec = NOW_SEC) =>
    markReceivedHistory(
      { listPayments: jest.fn().mockResolvedValue({ payments }) } as never,
      nowSec * 1000,
    )

  it("reads from a day before the newest payment received, knowing every one since", async () => {
    const mark = await markAt([
      received("rcv-a", NOW_SEC - 10),
      received("rcv-b", NOW_SEC - 10 - DAY),
      received("rcv-old", NOW_SEC - 11 - DAY),
    ])

    expect(mark).toEqual({
      walletClockSec: NOW_SEC - 10 - DAY,
      knownPaymentIds: ["rcv-a", "rcv-b"],
    })
  })

  /** A token payment carries its sender's clock, which can be ahead of the server's. */
  it("reads from a day before the phone's clock when a payment is stamped ahead of it", async () => {
    const mark = await markAt([
      received("rcv-ahead", NOW_SEC + 3600),
      received("rcv-a", NOW_SEC - 10),
    ])

    expect(mark).toEqual({
      walletClockSec: NOW_SEC - DAY,
      knownPaymentIds: ["rcv-ahead", "rcv-a"],
    })
  })

  /** A phone clock set ahead would put the mark after the delivery, and with nothing
   *  received there is nothing to tell the delivery apart from. */
  it("reads a wallet that received nothing from its start", async () => {
    const mark = await markAt([], NOW_SEC + 2 * DAY)

    expect(mark).toEqual({ walletClockSec: 0, knownPaymentIds: [] })
  })

  it("reads from the start of the history when the clocks say it began less than a day ago", async () => {
    const mark = await markAt([received("rcv-a", 100)], DAY - 1)

    expect(mark).toEqual({ walletClockSec: 0, knownPaymentIds: ["rcv-a"] })
  })

  /** What a full page leaves out is not known, so it is not read from. */
  it("reads from the oldest payment read when a page came back full", async () => {
    const page = Array.from({ length: 50 }, (_, i) => received(`rcv-${i}`, NOW_SEC - i))

    const mark = await markAt(page)

    expect(mark.walletClockSec).toBe(NOW_SEC - 49)
    expect(mark.knownPaymentIds).toHaveLength(50)
  })

  it("throws when the history cannot be read", async () => {
    const unreadable = new Error("storage failed")
    const listPayments = jest.fn().mockRejectedValue(unreadable)

    await expect(markReceivedHistory({ listPayments } as never)).rejects.toBe(unreadable)
  })

  it("throws when the history does not answer in time", async () => {
    jest.useFakeTimers()
    try {
      const listPayments = jest.fn().mockReturnValue(new Promise(() => {}))

      const failure = markReceivedHistory({ listPayments } as never).catch(
        (err: unknown) => err,
      )
      await jest.advanceTimersByTimeAsync(15_000)

      expect(await failure).toEqual(
        new Error("Received history mark timed out after 15000ms"),
      )
    } finally {
      jest.useRealTimers()
    }
  })
})

describe("findLostConversion", () => {
  const PAGE_SIZE = 50
  /** A second past the day after the lost conversion's latest attempt. */
  const PAST_THE_LOOK = MARK_SEC + 1 + 24 * 60 * 60 + 1

  /** A wallet of its own per test: the bridge keeps one sync in flight per wallet. */
  const walletAnswering = (...pages: Array<ReadonlyArray<unknown>>) => {
    const listPayments = jest.fn()
    pages.forEach((payments) => listPayments.mockResolvedValueOnce({ payments }))
    const syncWallet = jest.fn().mockResolvedValue({})
    return { listPayments, syncWallet }
  }

  /** Runs the lookup to its end, releasing each wait between looks. */
  const settle = async <T>(pending: Promise<T>): Promise<T> => {
    for (let i = 0; i < 3; i += 1) {
      await Promise.resolve()
      await jest.advanceTimersByTimeAsync(2000)
    }
    return pending
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("reads the payments received from the mark's second on, oldest first, once the wallet caught up", async () => {
    const sdk = walletAnswering([delivery()])

    await settle(findLostConversion({ sdk: sdk as never, lost: LOST }))

    expect(sdk.syncWallet).toHaveBeenCalled()
    expect(sdk.listPayments).toHaveBeenCalledWith(
      expect.objectContaining({
        typeFilter: [RECEIVE],
        fromTimestamp: BigInt(MARK_SEC),
        offset: 0,
        limit: PAGE_SIZE,
        sortAscending: true,
      }),
    )
  })

  /** A busy wallet keeps receiving long after the conversion went out; what came in a day
   *  later can no longer be its delivery, and is never read. */
  it("stops reading once a page reaches a day past the latest attempt", async () => {
    const page = Array.from({ length: PAGE_SIZE }, (_, i) =>
      received(`rcv-${i}`, i === PAGE_SIZE - 1 ? PAST_THE_LOOK : MARK_SEC + 5),
    )
    const sdk = walletAnswering(page, page, page)

    const lookup = await settle(findLostConversion({ sdk: sdk as never, lost: LOST }))

    expect(lookup.status).toBe("not-found")
    expect(sdk.listPayments).toHaveBeenCalledTimes(3)
  })

  it("does not take a delivery past that day, on the page that reaches it, for the lost one", async () => {
    const later = delivery({ id: "rcv-later", timestamp: PAST_THE_LOOK })
    const sdk = walletAnswering([later], [later], [later])

    const lookup = await settle(findLostConversion({ sdk: sdk as never, lost: LOST }))

    expect(lookup.status).toBe("not-found")
  })

  it("finds what the lost conversion delivered", async () => {
    const delivered = delivery()
    const sdk = walletAnswering([received("rcv-friend"), delivered])

    const lookup = await settle(findLostConversion({ sdk: sdk as never, lost: LOST }))

    expect(lookup).toEqual({ status: "found", payment: delivered, failed: [] })
  })

  it("answers not-found once every look read the history without it", async () => {
    const sdk = walletAnswering(
      [received("rcv-friend")],
      [received("rcv-friend")],
      [received("rcv-friend")],
    )

    const lookup = await settle(findLostConversion({ sdk: sdk as never, lost: LOST }))

    expect(lookup).toEqual({ status: "not-found", failed: [] })
    expect(sdk.listPayments).toHaveBeenCalledTimes(3)
  })

  /** A send without details may be the attempt itself, so a look for a send cannot rule
   *  it out; what a conversion delivered always names its conversion. */
  it("is not held up by a received payment without details", async () => {
    const bare = { ...received("rcv-bare"), details: undefined }
    const sdk = walletAnswering([bare], [bare], [bare])

    const lookup = await settle(findLostConversion({ sdk: sdk as never, lost: LOST }))

    expect(lookup.status).toBe("not-found")
  })

  it("cannot say the conversion is absent when the wallet could not catch up", async () => {
    const offline = new Error("offline")
    const sdk = walletAnswering([], [], [])
    sdk.syncWallet.mockRejectedValue(offline)

    const lookup = await settle(findLostConversion({ sdk: sdk as never, lost: LOST }))

    expect(lookup).toEqual({ status: "unreadable", error: offline })
  })
})
