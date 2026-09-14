import { renderHook } from "@testing-library/react-native"

import { flushEffects } from "../../helpers/flush-effects"

import { TxStatus, WalletCurrency } from "@app/graphql/generated"
import { useSelfCustodialTransactionFragments } from "@app/self-custodial/hooks/use-self-custodial-transaction-fragments"
import {
  NormalizedTransaction,
  PaymentType,
  TransactionDirection,
  TransactionStatus,
} from "@app/types/transaction"

const mockWriteFragment = jest.fn()
const mockBatch = jest.fn(({ update }: { update: (cache: unknown) => void }) =>
  update({
    identify: ({ id }: { id: string }) => `Transaction:${id}`,
    writeFragment: mockWriteFragment,
  }),
)

jest.mock("@apollo/client", () => ({
  ...jest.requireActual("@apollo/client"),
  useApolloClient: () => ({ cache: { batch: mockBatch } }),
}))

const mockConvertMoneyAmount = jest.fn()

jest.mock("@app/hooks/use-price-conversion", () => ({
  usePriceConversion: () => ({
    convertMoneyAmount: mockConvertMoneyAmount(),
    displayCurrency: "USD",
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ fractionDigits: 2 }),
}))

/** Real translations: the description resolver reaches deep into `LL` and a hand-rolled
 *  stub would only prove the stub matches itself. */
jest.mock("@app/i18n/i18n-react", () => {
  const { loadLocale } = jest.requireActual("@app/i18n/i18n-util.sync")
  const { i18nObject } = jest.requireActual("@app/i18n/i18n-util")
  loadLocale("en")

  return { useI18nContext: () => ({ LL: i18nObject("en") }) }
})

const makeTransaction = (
  overrides: Partial<NormalizedTransaction> = {},
): NormalizedTransaction => ({
  id: "tx-1",
  amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  direction: TransactionDirection.Send,
  status: TransactionStatus.Completed,
  timestamp: 1747691078,
  paymentType: PaymentType.Lightning,
  ...overrides,
})

describe("useSelfCustodialTransactionFragments", () => {
  const originalWarn = console.warn

  beforeAll(() => {
    /** React Native warns once that InteractionManager is deprecated. The hook keeps it
     *  for parity with the screens this logic was extracted from, so that one message is
     *  dropped here while every other warning still surfaces. */
    jest.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
      const [first] = args
      if (
        typeof first === "string" &&
        first.includes("InteractionManager has been deprecated")
      )
        return
      originalWarn(...args)
    })
  })

  afterAll(() => {
    jest.mocked(console.warn).mockRestore()
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockConvertMoneyAmount.mockReturnValue(undefined)
  })

  it("maps self-custodial transactions to the shared fragment shape", () => {
    const { result } = renderHook(() =>
      useSelfCustodialTransactionFragments([makeTransaction()]),
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toMatchObject({
      __typename: "Transaction",
      id: "tx-1",
      status: TxStatus.Success,
    })
  })

  it("drops failed payments so they never reach a history list", () => {
    const { result } = renderHook(() =>
      useSelfCustodialTransactionFragments([
        makeTransaction({ id: "ok" }),
        makeTransaction({ id: "failed", status: TransactionStatus.Failed }),
      ]),
    )

    expect(result.current.map((tx) => tx.id)).toEqual(["ok"])
  })

  it("primes the cache so the shared transaction item can read each fragment", async () => {
    renderHook(() => useSelfCustodialTransactionFragments([makeTransaction()]))
    await flushEffects()

    expect(mockBatch).toHaveBeenCalledTimes(1)
    expect(mockWriteFragment).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Transaction:tx-1" }),
    )
  })

  it("skips the cache write when there is nothing to prime", async () => {
    renderHook(() => useSelfCustodialTransactionFragments([]))
    await flushEffects()

    expect(mockBatch).not.toHaveBeenCalled()
  })

  it("still maps when no price conversion is available yet", () => {
    mockConvertMoneyAmount.mockReturnValue(undefined)

    const { result } = renderHook(() =>
      useSelfCustodialTransactionFragments([makeTransaction()]),
    )

    expect(result.current).toHaveLength(1)
    expect(result.current[0].settlementDisplayCurrency).toBe("BTC")
  })

  it("formats display amounts once the price conversion is ready", () => {
    mockConvertMoneyAmount.mockReturnValue((amount: { amount: number }) => ({
      amount: amount.amount,
      currency: "DisplayCurrency",
      currencyCode: "USD",
    }))

    const { result } = renderHook(() =>
      useSelfCustodialTransactionFragments([makeTransaction()]),
    )

    expect(result.current[0].settlementDisplayCurrency).toBe("USD")
  })

  it("never writes to the cache once it has unmounted", async () => {
    const { unmount } = renderHook(() =>
      useSelfCustodialTransactionFragments([makeTransaction()]),
    )
    unmount()
    await flushEffects()

    expect(mockBatch).not.toHaveBeenCalled()
  })
})
