import { renderHook } from "@testing-library/react-native"

import { useInvestmentInvoice } from "@app/screens/card-screen/onboarding/investment-flow/use-investment-invoice"

const mockCreateInvoice = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useLnInvoiceCreateOnBehalfOfRecipientMutation: () => [
    (...args: unknown[]) => mockCreateInvoice(...args),
    { loading: false },
  ],
}))

const RECIPIENT_WALLET_ID = "wallet-invest"
const SATOSHIS = 31_704_000

describe("useInvestmentInvoice", () => {
  beforeEach(() => {
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

    const minted = await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS)

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

    await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS)

    const { input } = mockCreateInvoice.mock.calls[0][0].variables
    expect(Number(input.expiresIn)).toBeGreaterThan(0)
  })

  /** The memo is a record rather than interface copy: the same payment has to read the
   *  same way in the receiving account's books whatever language the payer's phone is
   *  set to, so it is never translated. */
  it("names the payment in English, whatever the app's locale", async () => {
    const { result } = renderHook(() => useInvestmentInvoice())

    await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS)

    const { input } = mockCreateInvoice.mock.calls[0][0].variables
    expect(input.memo).toBe("Blink Private subscription")
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

    expect(await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS)).toBeNull()
  })

  it("answers with nothing when the mutation returns no data at all", async () => {
    mockCreateInvoice.mockResolvedValue({ data: null })

    const { result } = renderHook(() => useInvestmentInvoice())

    expect(await result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS)).toBeNull()
  })

  /**
   * A request that never reached the API rejects rather than answering. Left unhandled it
   * would leave the step silent: no invoice, no message, and an unhandled rejection.
   */
  it("answers with nothing when the request never reaches the API", async () => {
    mockCreateInvoice.mockRejectedValue(new Error("network request failed"))

    const { result } = renderHook(() => useInvestmentInvoice())

    await expect(
      result.current.requestInvoice(RECIPIENT_WALLET_ID, SATOSHIS),
    ).resolves.toBeNull()
  })
})
