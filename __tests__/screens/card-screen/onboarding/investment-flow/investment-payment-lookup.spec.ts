import { act, renderHook } from "@testing-library/react-native"

import { TxDirection, TxStatus } from "@app/graphql/generated"
import {
  lookUpInvestmentPayment,
  useLookUpInvestmentPayment,
  useReconcileInvestmentPayment,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-payment-lookup"
import {
  CardInvestmentPaymentLookup,
  CardInvestmentProgress,
} from "@app/types/card-investment"

/** The mainnet invoice used across the app's mocks (app/graphql/mocks.ts), decoded for
 *  real so the hash the ledger is asked with is the invoice's own. */
const INVOICE =
  "lnbc1p3lwh3npp5z5wkmy86gcww9u2h8tuekqmfz4pwlpkk4rfst8cm7jwzm8fklldsdqqcqzpuxqyz5" +
  "vqsp52fv968tprd3dqkuqsq78nw8s0xr9zn7rx686ukq2rfnsdf27pwtq9qyyssqhc7m7d3gfvdsywx9" +
  "56d3u3h45xyf7xurc6yv5qxysspjnhhxstl3wet525ldxn3x6xd0g58nk6wuvwle0fhn5sul396za3qs" +
  "5ma7zxsqjvklym"
const INVOICE_HASH = "151d6d90fa461ce2f1573af99b03691542ef86d6a8d3059f1bf49c2d9d36ffdb"

const send = (status: TxStatus) => ({
  status,
  direction: TxDirection.Send,
  createdAt: 1_757_702_000,
})
const received = {
  status: TxStatus.Success,
  direction: TxDirection.Receive,
  createdAt: 1,
}

/** The ledger, one wallet at a time: the sends it holds for the hash, or no answer. */
type WalletAnswer = ReturnType<typeof send>[] | (typeof received)[] | "unanswered"
const mockLedger: { current: Record<string, WalletAnswer> } = { current: {} }
const mockFetchTransactions = jest.fn(
  ({ variables }: { variables: { walletId: string; paymentHash: string } }) => {
    const answer = mockLedger.current[variables.walletId]
    if (answer === undefined || answer === "unanswered") {
      return Promise.resolve({ data: undefined })
    }
    return Promise.resolve({
      data: {
        me: { defaultAccount: { walletById: { transactionsByPaymentHash: answer } } },
      },
    })
  },
)
const mockNetwork: { current: string | undefined } = { current: "mainnet" }
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useTransactionsByPaymentHashLazyQuery: () => [mockFetchTransactions],
  useHomeUnauthedQuery: () => ({
    data: mockNetwork.current ? { globals: { network: mockNetwork.current } } : undefined,
  }),
}))

const mockWallets: { current: { id: string }[] | undefined } = {
  current: [{ id: "wallet-btc" }, { id: "wallet-usd" }],
}
jest.mock("@app/screens/send-bitcoin-screen/hooks/use-send-wallets", () => ({
  useSendWallets: () => ({ wallets: mockWallets.current }),
}))

const mockProgress: { current: CardInvestmentProgress | null } = { current: null }
const mockMarkPaid = jest.fn()
const mockClearPaying = jest.fn()
jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    progress: mockProgress.current,
    markPaid: mockMarkPaid,
    clearPaying: mockClearPaying,
  }),
}))

const SIGNED: CardInvestmentProgress = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: 1_757_700_000_000,
  invoice: { paymentRequest: INVOICE, issuedAt: 1_757_701_000_000 },
}
const PAYING: CardInvestmentProgress = { ...SIGNED, payingAt: 1_757_702_000_000 }

beforeEach(() => {
  jest.clearAllMocks()
  mockLedger.current = { "wallet-btc": [], "wallet-usd": [] }
  mockNetwork.current = "mainnet"
  mockWallets.current = [{ id: "wallet-btc" }, { id: "wallet-usd" }]
  mockProgress.current = null
})

describe("lookUpInvestmentPayment", () => {
  const fetchSendsFrom = (answers: Record<string, unknown>) => (walletId: string) => {
    const answer = answers[walletId]
    if (answer instanceof Error) return Promise.reject(answer)
    return Promise.resolve(answer as ReturnType<typeof send>[] | undefined)
  }
  const lookUp = (answers: Record<string, unknown>, walletIds = ["btc", "usd"]) =>
    lookUpInvestmentPayment({
      fetchSends: fetchSendsFrom(answers),
      walletIds,
      paymentHash: INVOICE_HASH,
    })

  it("answers settled when a wallet holds a settled send", async () => {
    expect(await lookUp({ btc: [], usd: [send(TxStatus.Success)] })).toBe(
      CardInvestmentPaymentLookup.Settled,
    )
  })

  it("answers pending when a wallet holds a send still on its way", async () => {
    expect(await lookUp({ btc: [send(TxStatus.Pending)], usd: [] })).toBe(
      CardInvestmentPaymentLookup.Pending,
    )
  })

  /** A payment is made from one wallet; once it is found the others are not asked. */
  it("stops at the first wallet that holds the send", async () => {
    const fetchSends = jest.fn(fetchSendsFrom({ btc: [send(TxStatus.Success)] }))

    await lookUpInvestmentPayment({
      fetchSends,
      walletIds: ["btc", "usd"],
      paymentHash: INVOICE_HASH,
    })

    expect(fetchSends).toHaveBeenCalledTimes(1)
  })

  /** Every wallet answered and none holds a send: the invoice was never paid. A failed
   *  send and money received are not a payment of it either. */
  it("answers not found when every wallet answered without the send", async () => {
    expect(await lookUp({ btc: [send(TxStatus.Failure)], usd: [received] })).toBe(
      CardInvestmentPaymentLookup.NotFound,
    )
  })

  /** Not being able to ask is not the same as finding nothing: the invoice may have been
   *  paid from the wallet that could not be asked. */
  it("answers unknown when a wallet could not be asked and none holds the send", async () => {
    expect(await lookUp({ btc: [], usd: undefined })).toBe(
      CardInvestmentPaymentLookup.Unknown,
    )
  })

  it("answers unknown when a request fails", async () => {
    expect(await lookUp({ btc: new Error("offline"), usd: [] })).toBe(
      CardInvestmentPaymentLookup.Unknown,
    )
  })

  it("still answers settled when another wallet could not be asked", async () => {
    expect(await lookUp({ btc: undefined, usd: [send(TxStatus.Success)] })).toBe(
      CardInvestmentPaymentLookup.Settled,
    )
  })

  it("answers unknown with no hash to ask with", async () => {
    const fetchSends = jest.fn()

    expect(
      await lookUpInvestmentPayment({
        fetchSends,
        walletIds: ["btc"],
        paymentHash: undefined,
      }),
    ).toBe(CardInvestmentPaymentLookup.Unknown)
    expect(fetchSends).not.toHaveBeenCalled()
  })

  it("answers unknown with no wallet to ask", async () => {
    expect(await lookUp({}, [])).toBe(CardInvestmentPaymentLookup.Unknown)
  })
})

describe("useLookUpInvestmentPayment", () => {
  it("asks each of the account's wallets with the invoice's own hash", async () => {
    mockLedger.current = { "wallet-btc": [], "wallet-usd": [send(TxStatus.Success)] }
    const { result } = renderHook(() => useLookUpInvestmentPayment())

    expect(await result.current(INVOICE)).toBe(CardInvestmentPaymentLookup.Settled)
    expect(mockFetchTransactions).toHaveBeenCalledWith({
      variables: { walletId: "wallet-btc", paymentHash: INVOICE_HASH },
    })
    expect(mockFetchTransactions).toHaveBeenCalledWith({
      variables: { walletId: "wallet-usd", paymentHash: INVOICE_HASH },
    })
  })

  it("answers not found when both wallets answered without the send", async () => {
    const { result } = renderHook(() => useLookUpInvestmentPayment())

    expect(await result.current(INVOICE)).toBe(CardInvestmentPaymentLookup.NotFound)
  })

  /** A request that came back without data is a wallet that could not be asked. */
  it("answers unknown when a wallet's request brings no data back", async () => {
    mockLedger.current = { "wallet-btc": [], "wallet-usd": "unanswered" }
    const { result } = renderHook(() => useLookUpInvestmentPayment())

    expect(await result.current(INVOICE)).toBe(CardInvestmentPaymentLookup.Unknown)
  })

  /** Without the network the invoice cannot be decoded, so nothing is asked. */
  it("answers unknown and asks nothing while the network is not known", async () => {
    mockNetwork.current = undefined
    const { result } = renderHook(() => useLookUpInvestmentPayment())

    expect(await result.current(INVOICE)).toBe(CardInvestmentPaymentLookup.Unknown)
    expect(mockFetchTransactions).not.toHaveBeenCalled()
  })

  it("answers unknown and asks nothing while the wallets are not known", async () => {
    mockWallets.current = undefined
    const { result } = renderHook(() => useLookUpInvestmentPayment())

    expect(await result.current(INVOICE)).toBe(CardInvestmentPaymentLookup.Unknown)
    expect(mockFetchTransactions).not.toHaveBeenCalled()
  })

  it("keeps the same function across renders", () => {
    const { result, rerender } = renderHook(() => useLookUpInvestmentPayment())
    const first = result.current

    rerender({})

    expect(result.current).toBe(first)
  })
})

describe("useReconcileInvestmentPayment", () => {
  it("records a payment on its way as paid once the ledger says it settled", async () => {
    mockProgress.current = PAYING
    mockLedger.current = { "wallet-btc": [send(TxStatus.Success)], "wallet-usd": [] }

    renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})

    expect(mockMarkPaid).toHaveBeenCalledTimes(1)
    expect(mockClearPaying).not.toHaveBeenCalled()
  })

  /** A failed payment leaves no send in any wallet; the home asks for the money again. */
  it("clears a payment on its way once every wallet answered without it", async () => {
    mockProgress.current = PAYING

    renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})

    expect(mockClearPaying).toHaveBeenCalledTimes(1)
    expect(mockMarkPaid).not.toHaveBeenCalled()
  })

  it("keeps waiting on a payment the ledger still holds as pending", async () => {
    mockProgress.current = PAYING
    mockLedger.current = { "wallet-btc": [send(TxStatus.Pending)], "wallet-usd": [] }

    renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})

    expect(mockMarkPaid).not.toHaveBeenCalled()
    expect(mockClearPaying).not.toHaveBeenCalled()
  })

  /** Offline, a payment on its way must not be forgotten: the home would ask for the
   *  money again while it may still land. */
  it("keeps waiting when a wallet could not be asked", async () => {
    mockProgress.current = PAYING
    mockLedger.current = { "wallet-btc": [], "wallet-usd": "unanswered" }

    renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})

    expect(mockMarkPaid).not.toHaveBeenCalled()
    expect(mockClearPaying).not.toHaveBeenCalled()
  })

  /** A home opened before the network was known asks again once it is, rather than
   *  reading the silence as a failed payment. */
  it("asks again once the network is known", async () => {
    mockProgress.current = PAYING
    mockNetwork.current = undefined
    mockLedger.current = { "wallet-btc": [send(TxStatus.Success)], "wallet-usd": [] }

    const { rerender } = renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})
    expect(mockClearPaying).not.toHaveBeenCalled()
    expect(mockMarkPaid).not.toHaveBeenCalled()

    mockNetwork.current = "mainnet"
    rerender({})
    await act(async () => {})

    expect(mockMarkPaid).toHaveBeenCalledTimes(1)
  })

  it("asks nothing while no payment is on its way", async () => {
    mockProgress.current = SIGNED

    renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})

    expect(mockFetchTransactions).not.toHaveBeenCalled()
  })

  it("asks nothing once the payment is recorded as paid", async () => {
    mockProgress.current = { ...PAYING, paidAt: 1_757_703_000_000 }

    renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})

    expect(mockFetchTransactions).not.toHaveBeenCalled()
  })

  /** A record marked as paying with no invoice to ask about cannot be reconciled;
   *  nothing is invented for it. */
  it("asks nothing when the record names no invoice", async () => {
    const { invoice: _none, ...withoutInvoice } = PAYING
    mockProgress.current = withoutInvoice

    renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})

    expect(mockFetchTransactions).not.toHaveBeenCalled()
    expect(mockClearPaying).not.toHaveBeenCalled()
  })

  it("asks once for the same record", async () => {
    mockProgress.current = PAYING
    mockLedger.current = { "wallet-btc": [send(TxStatus.Pending)], "wallet-usd": [] }

    const { rerender } = renderHook(() => useReconcileInvestmentPayment())
    await act(async () => {})
    await act(async () => {
      rerender({})
    })

    expect(mockFetchTransactions).toHaveBeenCalledTimes(1)
  })

  /** The answer to a question asked by a home that has since gone is dropped rather
   *  than written from beyond it. */
  it("drops an answer that arrives after unmount", async () => {
    mockProgress.current = PAYING
    const settledAnswer = {
      data: {
        me: {
          defaultAccount: {
            walletById: { transactionsByPaymentHash: [send(TxStatus.Success)] },
          },
        },
      },
    }
    let answer: (value: typeof settledAnswer) => void = () => {}
    mockFetchTransactions.mockReturnValueOnce(
      new Promise<typeof settledAnswer>((resolve) => {
        answer = resolve
      }),
    )

    const { unmount } = renderHook(() => useReconcileInvestmentPayment())
    unmount()
    await act(async () => {
      answer(settledAnswer)
    })

    expect(mockMarkPaid).not.toHaveBeenCalled()
  })
})
