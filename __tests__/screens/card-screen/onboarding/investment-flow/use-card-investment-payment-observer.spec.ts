import { renderHook } from "@testing-library/react-native"

import { useCardInvestmentPaymentObserver } from "@app/screens/card-screen/onboarding/investment-flow/use-card-investment-payment-observer"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { CardInvestmentProgress } from "@app/types/card-investment"
import { AccountType } from "@app/types/wallet"

/**
 * The record hook runs for real over a mocked store, so what is pinned here is how the
 * observer reads the invoice off the record, not a stand-in for that reading.
 */
const mockUpdateState = jest.fn()
let mockPersistentState: PersistentState
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { type: AccountType.Custodial, id: "custodial-default" },
  }),
}))
jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))
const ACCOUNT_ID = "custodial-account-1"
jest.mock("@app/graphql/generated", () => ({
  useCardInvestmentAccountQuery: () => ({
    data: { me: { id: "user", defaultAccount: { id: ACCOUNT_ID } } },
    refetch: () => Promise.resolve(),
  }),
}))

const NOW = 1_757_800_000_000
const INVOICE = "lnbc25m1investment"
const SIGNED: CardInvestmentProgress = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: NOW - 60_000,
}
const ISSUED: CardInvestmentProgress = {
  ...SIGNED,
  invoice: { paymentRequest: INVOICE, issuedAt: NOW - 30_000 },
}

const stateWith = (progress: CardInvestmentProgress | null): PersistentState => ({
  schemaVersion: 22,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  ...(progress ? { cardInvestmentByAccountId: { [ACCOUNT_ID]: progress } } : {}),
})

/** Runs the functional updater the hook handed to the store against the current state. */
const recordAfterLastUpdate = () => {
  const updater = mockUpdateState.mock.calls[mockUpdateState.mock.calls.length - 1][0]
  const next = updater(mockPersistentState) as PersistentState
  return next.cardInvestmentByAccountId?.[ACCOUNT_ID]
}

describe("useCardInvestmentPaymentObserver", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = stateWith(ISSUED)
    jest.spyOn(Date, "now").mockReturnValue(NOW)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("which payments it follows", () => {
    it("follows the invoice on record, in either case", () => {
      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      expect(result.current.isObserved(INVOICE)).toBe(true)
      expect(result.current.isObserved(INVOICE.toUpperCase())).toBe(true)
    })

    it("does not follow any other payment", () => {
      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      expect(result.current.isObserved("lnbc1someoneelse")).toBe(false)
      expect(result.current.isObserved(undefined)).toBe(false)
    })

    it("follows nothing while no invoice is on record", () => {
      mockPersistentState = stateWith(SIGNED)

      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      expect(result.current.isObserved(INVOICE)).toBe(false)
    })

    it("follows nothing for an account that never signed", () => {
      mockPersistentState = stateWith(null)

      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      expect(result.current.isObserved(INVOICE)).toBe(false)
    })
  })

  describe("when one of its payments reaches a receipt", () => {
    it("marks the investment paid on a settled receipt", () => {
      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      result.current.onSettled(INVOICE, "SUCCESS")

      expect(recordAfterLastUpdate()).toEqual({ ...ISSUED, paidAt: NOW })
    })

    /** A pending payment can still fail, and the record has a way back from "paying"
     *  but not from "paid". */
    it("marks the investment as paying on a pending receipt", () => {
      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      result.current.onSettled(INVOICE, "PENDING")

      expect(recordAfterLastUpdate()).toEqual({ ...ISSUED, payingAt: NOW })
    })

    it("marks a payment already on its way as paid once it settles", () => {
      mockPersistentState = stateWith({ ...ISSUED, payingAt: NOW - 10_000 })
      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      result.current.onSettled(INVOICE, "SUCCESS")

      expect(recordAfterLastUpdate()).toEqual({ ...ISSUED, paidAt: NOW })
    })

    /** A later receipt for the same invoice, the retry that met "already paid", finds
     *  the mark and leaves it. */
    it("leaves the first mark on an investment already paid", () => {
      const paid = { ...ISSUED, paidAt: NOW - 10_000 }
      mockPersistentState = stateWith(paid)
      const { result } = renderHook(() => useCardInvestmentPaymentObserver())

      result.current.onSettled(INVOICE, "SUCCESS")
      expect(recordAfterLastUpdate()).toEqual(paid)

      result.current.onSettled(INVOICE, "PENDING")
      expect(recordAfterLastUpdate()).toEqual(paid)
    })
  })

  it("keeps the same observer while the record stands", () => {
    const { result, rerender } = renderHook(() => useCardInvestmentPaymentObserver())
    const first = result.current

    rerender({})

    expect(result.current).toBe(first)
  })
})
