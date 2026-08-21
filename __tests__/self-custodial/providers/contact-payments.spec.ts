import { fetchContactPaymentsPage } from "@app/self-custodial/providers/contact-payments"
import { NormalizedTransaction, TransactionDirection } from "@app/types/transaction"

const mockFetchAndMapPayments = jest.fn()

jest.mock("@app/self-custodial/providers/payments-page", () => ({
  ...jest.requireActual("@app/self-custodial/providers/payments-page"),
  fetchAndMapPayments: (...args: unknown[]) => mockFetchAndMapPayments(...args),
}))

const sdk = { id: "sdk" } as never

const tx = (
  id: string,
  lnAddress?: string,
  direction: TransactionDirection = TransactionDirection.Send,
) => ({ id, lnAddress, direction }) as unknown as NormalizedTransaction

/** One raw SDK page: `rawCount` counts what the SDK answered, not what survived mapping. */
const rawPage = (
  transactions: NormalizedTransaction[],
  { rawCount = 20, hasMore = true }: { rawCount?: number; hasMore?: boolean } = {},
) => ({ transactions, rawCount, hasMore })

describe("fetchContactPaymentsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("keeps only the payments whose lightning address is the contact's", async () => {
    mockFetchAndMapPayments.mockResolvedValue(
      rawPage([tx("mine", "alice@blink.sv"), tx("theirs", "bob@blink.sv"), tx("none")], {
        hasMore: false,
      }),
    )

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(page.transactions.map((t) => t.id)).toEqual(["mine"])
  })

  it("lists what the contact was paid and what they paid back", async () => {
    mockFetchAndMapPayments.mockResolvedValue(
      rawPage(
        [
          tx("sent", "alice@blink.sv"),
          tx("received", "alice@blink.sv", TransactionDirection.Receive),
        ],
        { hasMore: false },
      ),
    )

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(page.transactions.map((t) => t.id)).toEqual(["sent", "received"])
  })

  it("leaves out a receive addressed to anyone but the contact", async () => {
    // A received payment that carries the user's own address rather than the sender's
    // belongs to no contact, and must not surface on every contact screen.
    mockFetchAndMapPayments.mockResolvedValue(
      rawPage([tx("mine", "me@blink.sv", TransactionDirection.Receive)], {
        hasMore: false,
      }),
    )

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(page.transactions).toEqual([])
  })

  it("matches regardless of case or surrounding whitespace", async () => {
    mockFetchAndMapPayments.mockResolvedValue(
      rawPage([tx("mine", "  ALICE@Blink.SV ")], { hasMore: false }),
    )

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(page.transactions.map((t) => t.id)).toEqual(["mine"])
  })

  it("resumes from the offset it is given", async () => {
    mockFetchAndMapPayments.mockResolvedValue(rawPage([], { hasMore: false }))

    await fetchContactPaymentsPage(sdk, "alice@blink.sv", 40)

    expect(mockFetchAndMapPayments).toHaveBeenCalledWith(sdk, 40)
  })

  it("keeps reading past raw pages that hold nothing for this contact", async () => {
    mockFetchAndMapPayments
      .mockResolvedValueOnce(rawPage([tx("stranger", "bob@blink.sv")]))
      .mockResolvedValueOnce(rawPage([tx("stranger-2", "carol@blink.sv")]))
      .mockResolvedValueOnce(rawPage([tx("mine", "alice@blink.sv")], { hasMore: false }))

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(mockFetchAndMapPayments).toHaveBeenCalledTimes(3)
    expect(mockFetchAndMapPayments).toHaveBeenNthCalledWith(2, sdk, 20)
    expect(mockFetchAndMapPayments).toHaveBeenNthCalledWith(3, sdk, 40)
    expect(page.transactions.map((t) => t.id)).toEqual(["mine"])
  })

  it("stops once it has filled a page of matches, leaving a cursor to resume from", async () => {
    const full = Array.from({ length: 20 }, (_, i) => tx(`tx-${i}`, "alice@blink.sv"))
    mockFetchAndMapPayments.mockResolvedValue(rawPage(full))

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(mockFetchAndMapPayments).toHaveBeenCalledTimes(1)
    expect(page.transactions).toHaveLength(20)
    expect(page).toMatchObject({ rawOffset: 20, hasMore: true })
  })

  it("reports the history as exhausted when the wallet runs out", async () => {
    mockFetchAndMapPayments.mockResolvedValue(
      rawPage([tx("mine", "alice@blink.sv")], { rawCount: 7, hasMore: false }),
    )

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(page).toMatchObject({ rawOffset: 7, hasMore: false })
  })

  it("gives up its budget rather than walking the whole wallet for a sparse contact", async () => {
    mockFetchAndMapPayments.mockResolvedValue(rawPage([tx("stranger", "bob@blink.sv")]))

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 0)

    expect(mockFetchAndMapPayments).toHaveBeenCalledTimes(5)
    expect(page.transactions).toEqual([])
    expect(page).toMatchObject({ rawOffset: 100, hasMore: true })
  })

  it("stops on an empty answer without advancing the cursor", async () => {
    mockFetchAndMapPayments.mockResolvedValue(rawPage([], { rawCount: 0 }))

    const page = await fetchContactPaymentsPage(sdk, "alice@blink.sv", 60)

    expect(mockFetchAndMapPayments).toHaveBeenCalledTimes(1)
    expect(page).toEqual({ transactions: [], rawOffset: 60, hasMore: false })
  })
})
