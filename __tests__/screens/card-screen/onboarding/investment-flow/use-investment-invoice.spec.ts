import { renderHook } from "@testing-library/react-native"

import {
  isInvoiceReusable,
  useInvestmentInvoice,
} from "@app/screens/card-screen/onboarding/investment-flow/use-investment-invoice"

const mockCreateInvoice = jest.fn()
const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useLnInvoiceCreateOnBehalfOfRecipientMutation: () => [
    (...args: unknown[]) => mockCreateInvoice(...args),
    { loading: false },
  ],
}))

const RECIPIENT_WALLET_ID = "wallet-invest"
const SATOSHIS = 31_704_000
/** The paying account, in the shape the server gives ids: a lowercase uuid. */
const ACCOUNT_ID = "0f1e2d3c-4b5a-4968-8776-655443322110"
const SUBSCRIBER = { accountId: ACCOUNT_ID, amountUsd: 25000 }
/** What the ledger accepts as an external id, as its own validation states it. */
const LEDGER_EXTERNAL_ID = /^[a-z0-9_-]{1,100}$/
const MINTED_AT = 1_757_800_000_000

describe("useInvestmentInvoice", () => {
  beforeEach(() => {
    jest.restoreAllMocks()
    jest.clearAllMocks()
    mockCreateInvoice.mockResolvedValue({
      data: {
        lnInvoiceCreateOnBehalfOfRecipient: {
          errors: [],
          invoice: { paymentRequest: "lnbc-invoice" },
        },
      },
    })
  })

  it("asks the recipient's wallet for an invoice of the agreed amount", async () => {
    const { result } = renderHook(() => useInvestmentInvoice())

    const minted = await result.current.requestInvoice(
      RECIPIENT_WALLET_ID,
      SATOSHIS,
      SUBSCRIBER,
    )

    expect(minted).toEqual({ paymentRequest: "lnbc-invoice" })
    expect(mockCreateInvoice).toHaveBeenCalledWith({
      variables: {
        input: expect.objectContaining({
          recipientWalletId: RECIPIENT_WALLET_ID,
          amount: SATOSHIS,
        }),
      },
    })
  })

  /** An invoice that outlives the attempt leaves a payable claim on the receiving
   *  account long after the investor walked away. */
  it("gives the invoice an expiry", async () => {
    const { result } = renderHook(() => useInvestmentInvoice())

    await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER)

    const { input } = mockCreateInvoice.mock.calls[0][0].variables
    expect(Number(input.expiresIn)).toBeGreaterThan(0)
  })

  /** The memo is a record rather than interface copy: the same payment has to read the
   *  same way in the receiving account's books whatever language the payer's phone is
   *  set to, so it is never translated. */
  it("names the payment in English, whatever the app's locale", async () => {
    const { result } = renderHook(() => useInvestmentInvoice())

    await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER)

    const { input } = mockCreateInvoice.mock.calls[0][0].variables
    expect(input.memo).toBe("Blink Private subscription")
  })

  /** The memo names no one, so the account and the amount are what tie the payment to
   *  its subscriber in the receiving ledger; the id has to be one the ledger accepts. */
  it("files the payment under the paying account and the amount signed for", async () => {
    jest.spyOn(Date, "now").mockReturnValue(MINTED_AT)
    const { result } = renderHook(() => useInvestmentInvoice())

    await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER)

    const { input } = mockCreateInvoice.mock.calls[0][0].variables
    expect(input.externalId).toBe(`investment_${ACCOUNT_ID}_25000_${MINTED_AT}`)
    expect(input.externalId).toMatch(LEDGER_EXTERNAL_ID)
  })

  /** The ledger keeps the id unique per receiving account and never drops an unpaid
   *  invoice, so an investor minting again for the same amount, once the first invoice
   *  is too old to reuse, must not be refused as a duplicate. */
  it("gives each mint for the same subscriber its own id", async () => {
    jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(MINTED_AT)
      .mockReturnValueOnce(MINTED_AT + 1)
    const { result } = renderHook(() => useInvestmentInvoice())

    await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER)
    await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER)

    const [first, second] = mockCreateInvoice.mock.calls.map(
      ([call]) => call.variables.input.externalId,
    )
    expect(first).not.toBe(second)
    expect(second).toMatch(LEDGER_EXTERNAL_ID)
  })

  /** A payment filed under nobody is what the id exists to prevent, so none is minted
   *  without an account; the log says so, since the screen only shows a failed invoice. */
  it("mints nothing while the paying account is unknown", async () => {
    const { result } = renderHook(() => useInvestmentInvoice())

    const minted = await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, {
      ...SUBSCRIBER,
      accountId: null,
    })

    expect(minted).toBeNull()
    expect(mockCreateInvoice).not.toHaveBeenCalled()
    expect(mockReportError).toHaveBeenCalledWith(
      "investment-invoice",
      new Error("no account to file the investment payment under"),
    )
  })

  /** The caller opens the send flow on what comes back, so answering with nothing has to
   *  be distinguishable from answering with an invoice. */
  it("answers with nothing when the account issues no invoice", async () => {
    mockCreateInvoice.mockResolvedValue({
      data: {
        lnInvoiceCreateOnBehalfOfRecipient: {
          errors: [{ message: "recipient wallet not found" }],
          invoice: null,
        },
      },
    })

    const { result } = renderHook(() => useInvestmentInvoice())

    expect(
      await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER),
    ).toBeNull()
    /** The reason is the one thing that tells a wrong wallet id apart from an outage. */
    expect(mockReportError).toHaveBeenCalledWith(
      "investment-invoice",
      new Error("recipient wallet not found"),
    )
  })

  it("answers with nothing when the mutation returns no data at all", async () => {
    mockCreateInvoice.mockResolvedValue({ data: null })

    const { result } = renderHook(() => useInvestmentInvoice())

    expect(
      await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER),
    ).toBeNull()
    expect(mockReportError).not.toHaveBeenCalled()
  })

  /**
   * A request that never reached the API rejects rather than answering. Left unhandled it
   * would leave the step silent: no invoice, no message, and an unhandled rejection.
   */
  it("answers with nothing when the request never reaches the API", async () => {
    mockCreateInvoice.mockRejectedValue(new Error("network request failed"))

    const { result } = renderHook(() => useInvestmentInvoice())

    await expect(
      result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS, SUBSCRIBER),
    ).resolves.toBeNull()
    expect(mockReportError).toHaveBeenCalledWith(
      "investment-invoice",
      new Error("network request failed"),
    )
  })
})

describe("isInvoiceReusable", () => {
  const ISSUED_AT = 1_757_800_000_000
  const MINUTE_MS = 60 * 1000

  /** The invoice lives thirty minutes; it is handed back only while a payment started
   *  now can still land inside that, so the last five minutes are left alone. */
  it("hands the invoice back while enough of its life is left to pay it", () => {
    expect(isInvoiceReusable(ISSUED_AT, ISSUED_AT)).toBe(true)
    expect(isInvoiceReusable(ISSUED_AT, ISSUED_AT + 24 * MINUTE_MS)).toBe(true)
  })

  it("has it reissued once it is too old to pay in time", () => {
    expect(isInvoiceReusable(ISSUED_AT, ISSUED_AT + 25 * MINUTE_MS)).toBe(false)
    expect(isInvoiceReusable(ISSUED_AT, ISSUED_AT + 31 * MINUTE_MS)).toBe(false)
  })
})
