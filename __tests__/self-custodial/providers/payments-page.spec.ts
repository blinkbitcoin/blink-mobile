import {
  fetchAndMapPayments,
  TRANSACTIONS_PER_PAGE,
} from "@app/self-custodial/providers/payments-page"

const mockListPayments = jest.fn()
const mockMapTransactions = jest.fn()
const mockRecordErrorOnce = jest.fn()
const mockSparkTokenIdentifier = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  PaymentMethod: { Token: "Token", Lightning: "Lightning" },
  PaymentDetails: {
    Token: {
      instanceOf: (details: { tag?: string }) => details?.tag === "Token",
    },
  },
}))

jest.mock("@app/self-custodial/bridge", () => ({
  listPayments: (...args: unknown[]) => mockListPayments(...args),
}))

jest.mock("@app/self-custodial/config", () => ({
  sparkTokenIdentifier: () => mockSparkTokenIdentifier(),
}))

jest.mock("@app/self-custodial/logging", () => ({
  recordErrorOnce: (...args: unknown[]) => mockRecordErrorOnce(...args),
}))

/** Only the mapping is stubbed. `isKnownPayment` comes from the module itself so the
 *  token filtering below exercises the real predicate against the mocked config. */
jest.mock("@app/self-custodial/mappers/transaction", () => ({
  ...jest.requireActual("@app/self-custodial/mappers/transaction"),
  mapSelfCustodialTransactions: (...args: unknown[]) => mockMapTransactions(...args),
}))

const sdk = { id: "sdk" } as never

const lightningPayment = { id: "ln", method: "Lightning" }

const tokenPayment = (identifier: string) => ({
  id: `token-${identifier}`,
  method: "Token",
  details: { tag: "Token", inner: { metadata: { identifier } } },
})

describe("fetchAndMapPayments", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMapTransactions.mockReturnValue([])
    mockSparkTokenIdentifier.mockReturnValue("usdb")
  })

  it("asks the SDK for one page starting at the given offset", async () => {
    mockListPayments.mockResolvedValue({ payments: [] })

    await fetchAndMapPayments(sdk, 40)

    expect(mockListPayments).toHaveBeenCalledWith(sdk, 40, TRANSACTIONS_PER_PAGE)
  })

  it("counts what the SDK answered, not what survived mapping", async () => {
    mockListPayments.mockResolvedValue({ payments: [lightningPayment, lightningPayment] })
    mockMapTransactions.mockReturnValue([{ id: "only-one" }])

    const page = await fetchAndMapPayments(sdk, 0)

    expect(page.rawCount).toBe(2)
    expect(page.transactions).toEqual([{ id: "only-one" }])
  })

  it("reports more pages while the SDK fills the page it was asked for", async () => {
    mockListPayments.mockResolvedValue({
      payments: Array.from({ length: TRANSACTIONS_PER_PAGE }, () => lightningPayment),
    })

    const page = await fetchAndMapPayments(sdk, 0)

    expect(page.hasMore).toBe(true)
  })

  it("reports the history as exhausted on a short page", async () => {
    mockListPayments.mockResolvedValue({ payments: [lightningPayment] })

    const page = await fetchAndMapPayments(sdk, 0)

    expect(page.hasMore).toBe(false)
  })

  it("keeps every payment that is not a token payment", async () => {
    mockListPayments.mockResolvedValue({ payments: [lightningPayment] })

    await fetchAndMapPayments(sdk, 0)

    expect(mockMapTransactions).toHaveBeenCalledWith([lightningPayment])
  })

  it("keeps token payments minted by the token this build expects", async () => {
    const known = tokenPayment("usdb")
    mockListPayments.mockResolvedValue({ payments: [known] })

    await fetchAndMapPayments(sdk, 0)

    expect(mockMapTransactions).toHaveBeenCalledWith([known])
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })

  it("drops a token payment from an unknown token and reports it once", async () => {
    mockListPayments.mockResolvedValue({ payments: [tokenPayment("counterfeit")] })

    await fetchAndMapPayments(sdk, 0)

    expect(mockMapTransactions).toHaveBeenCalledWith([])
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "spark-unknown-token-payment:counterfeit",
      expect.objectContaining({
        message: expect.stringContaining("Unknown token payment dropped"),
      }),
    )
  })

  /** Staging has no dollar token unless the build names one: any token payment there has
   *  no wallet to land in, and reading the token must not throw on the history page. */
  it("drops every token payment on a network with no token configured", async () => {
    mockSparkTokenIdentifier.mockReturnValue(null)
    mockListPayments.mockResolvedValue({
      payments: [lightningPayment, tokenPayment("btknrt1-any")],
    })

    await fetchAndMapPayments(sdk, 0)

    expect(mockMapTransactions).toHaveBeenCalledWith([lightningPayment])
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "spark-unknown-token-payment:btknrt1-any",
      expect.objectContaining({ message: expect.stringContaining("expected=none") }),
    )
  })

  it("drops a token payment whose details are missing or not token details", async () => {
    mockListPayments.mockResolvedValue({
      payments: [
        { id: "no-details", method: "Token" },
        { id: "wrong-details", method: "Token", details: { tag: "Lightning" } },
      ],
    })

    await fetchAndMapPayments(sdk, 0)

    expect(mockMapTransactions).toHaveBeenCalledWith([])
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })
})
