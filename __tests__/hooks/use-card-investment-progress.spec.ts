import { act, renderHook } from "@testing-library/react-native"

import {
  armCardInvestmentPayment,
  consumeCardInvestmentPayment,
  isCardInvestmentPaymentArmed,
  useCardInvestmentProgress,
  useConsumeCardInvestmentPayment,
} from "@app/hooks/use-card-investment-progress"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { CardInvestmentProgress } from "@app/types/card-investment"
import { AccountType } from "@app/types/wallet"

const mockUpdateState = jest.fn()
let mockPersistentState: PersistentState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

const mockActiveAccount: { current: { type: string; id: string } | null } = {
  current: null,
}
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount.current }),
}))

const mockIsAuthed = { current: true }
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed.current,
}))

/** The custodial account's server id, as the cache the home filled answers it. */
const mockCardInvestmentAccountQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useCardInvestmentAccountQuery: (options: unknown) =>
    mockCardInvestmentAccountQuery(options),
}))

const SELF_CUSTODIAL_ID = "self-custodial-1"
const CUSTODIAL_ID = "custodial-account-1"
const OTHER_CUSTODIAL_ID = "custodial-account-2"
const NOW = 1_757_800_000_000
const A_DAY_MS = 24 * 60 * 60 * 1000
const INVESTMENT = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: NOW - 60_000,
}

const baseState: PersistentState = {
  schemaVersion: 22,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

const stateWith = (entries: Record<string, CardInvestmentProgress>): PersistentState => ({
  ...baseState,
  cardInvestmentByAccountId: entries,
})

const selfCustodialSession = () => {
  mockActiveAccount.current = { type: AccountType.SelfCustodial, id: SELF_CUSTODIAL_ID }
}

/** `answer` is what the server said about the account: an id, or one of the empty
 *  shapes a fresh session can be served before the account exists. */
const custodialSession = (answer: string | null | { me: unknown } = CUSTODIAL_ID) => {
  mockActiveAccount.current = { type: AccountType.Custodial, id: "custodial-default" }
  const data =
    typeof answer === "string"
      ? { me: { id: "user", defaultAccount: { id: answer } } }
      : answer ?? undefined
  mockCardInvestmentAccountQuery.mockReturnValue({ data })
}

/** Runs the functional updater the hook handed to the store against a given state. */
/** What the signing step hands over; the hook stamps the moment itself. */
const SIGNING = { selectedAmountUsd: 25000, settlementSats: 31_704_000 }

const applyLastUpdate = (state: PersistentState | undefined) => {
  const updater = mockUpdateState.mock.calls[mockUpdateState.mock.calls.length - 1][0]
  expect(typeof updater).toBe("function")
  return updater(state) as PersistentState | undefined
}

describe("useCardInvestmentProgress", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = { ...baseState }
    mockIsAuthed.current = true
    custodialSession()
    jest.spyOn(Date, "now").mockReturnValue(NOW)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("which account the investment is filed under", () => {
    /** The investment is paid from a custodial balance, so a self-custodial account
     *  has no part in it: nothing is read for it, nothing is written, and the server
     *  is not asked for an id. */
    it("has no part for a self-custodial account, whatever the store holds", () => {
      selfCustodialSession()
      mockPersistentState = stateWith({ [SELF_CUSTODIAL_ID]: INVESTMENT })

      const { result } = renderHook(() => useCardInvestmentProgress())
      act(() => {
        result.current.start(SIGNING)
        result.current.markPaid()
        result.current.clear()
      })

      expect(result.current.isEligible).toBe(false)
      expect(result.current.isAccountResolved).toBe(false)
      expect(result.current.progress).toBeNull()
      expect(mockUpdateState).not.toHaveBeenCalled()
      expect(mockCardInvestmentAccountQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it("lets a custodial account take part", () => {
      expect(
        renderHook(() => useCardInvestmentProgress()).result.current.isEligible,
      ).toBe(true)
    })

    it("files a custodial account under its server id", () => {
      custodialSession()
      mockPersistentState = stateWith({ [CUSTODIAL_ID]: INVESTMENT })

      const { result } = renderHook(() => useCardInvestmentProgress())

      expect(result.current.progress).toEqual(INVESTMENT)
      expect(mockCardInvestmentAccountQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false, fetchPolicy: "cache-first" }),
      )
    })

    /** Two custodial profiles on one device share the store's active-account slot; the
     *  investment one of them signed must not surface, or be paid, on the other's home. */
    it("does not show one custodial profile the investment another one signed", () => {
      custodialSession(OTHER_CUSTODIAL_ID)
      mockPersistentState = stateWith({ [CUSTODIAL_ID]: INVESTMENT })

      const { result } = renderHook(() => useCardInvestmentProgress())

      expect(result.current.progress).toBeNull()
    })

    it("has no progress and drops every write while the custodial id is unknown", () => {
      custodialSession(null)
      mockPersistentState = stateWith({ [CUSTODIAL_ID]: INVESTMENT })

      const { result } = renderHook(() => useCardInvestmentProgress())
      act(() => {
        result.current.start(SIGNING)
        result.current.recordInvoice("lnbc25m1investment")
        result.current.markPaid()
        result.current.clear()
      })

      expect(result.current.progress).toBeNull()
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    /** Right after device-account creation the server can answer without an account,
     *  or without a user at all; neither is an id to file anything under. */
    it("has nothing to file under while the server names no account", () => {
      mockPersistentState = stateWith({ [CUSTODIAL_ID]: INVESTMENT })

      custodialSession({ me: null })
      expect(
        renderHook(() => useCardInvestmentProgress()).result.current.progress,
      ).toBeNull()

      custodialSession({ me: { id: "user", defaultAccount: null } })
      expect(
        renderHook(() => useCardInvestmentProgress()).result.current.progress,
      ).toBeNull()
    })

    it("files under the server id when the registry names no account yet", () => {
      custodialSession()
      mockActiveAccount.current = null
      mockPersistentState = stateWith({ [CUSTODIAL_ID]: INVESTMENT })

      const { result } = renderHook(() => useCardInvestmentProgress())

      expect(result.current.progress).toEqual(INVESTMENT)
    })

    it("does not ask the server for an id when there is no session", () => {
      custodialSession()
      mockIsAuthed.current = false

      renderHook(() => useCardInvestmentProgress())

      expect(mockCardInvestmentAccountQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })
  })

  it("has no progress while nothing was signed", () => {
    const { result } = renderHook(() => useCardInvestmentProgress())

    expect(result.current.progress).toBeNull()
  })

  /** A day on, the agreement and its payment link have lapsed; the home starts over. */
  it("reads a record a day old as nothing", () => {
    mockPersistentState = stateWith({
      [CUSTODIAL_ID]: { ...INVESTMENT, signedAt: NOW - A_DAY_MS },
    })
    expect(
      renderHook(() => useCardInvestmentProgress()).result.current.progress,
    ).toBeNull()
  })

  describe("start", () => {
    it("records the signed investment for the active account, stamped now", () => {
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.start(SIGNING))

      expect(applyLastUpdate(baseState)?.cardInvestmentByAccountId).toEqual({
        [CUSTODIAL_ID]: { ...SIGNING, signedAt: NOW },
      })
    })

    it("leaves an unloaded store alone", () => {
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.start(SIGNING))

      expect(applyLastUpdate(undefined)).toBeUndefined()
    })
  })

  describe("markPaid", () => {
    it("stamps the payment on the signed investment", () => {
      const signed = stateWith({ [CUSTODIAL_ID]: INVESTMENT })
      mockPersistentState = signed
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.markPaid())

      expect(applyLastUpdate(signed)?.cardInvestmentByAccountId).toEqual({
        [CUSTODIAL_ID]: { ...INVESTMENT, paidAt: NOW },
      })
    })

    /** A payment with no investment behind it is not this record's to invent. */
    it("changes nothing when nothing was signed", () => {
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.markPaid())

      expect(applyLastUpdate(baseState)).toBe(baseState)
    })

    it("leaves an unloaded store alone", () => {
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.markPaid())

      expect(applyLastUpdate(undefined)).toBeUndefined()
    })
  })

  describe("recordInvoice", () => {
    it("stamps the issued invoice on the signed investment", () => {
      const signed = stateWith({ [CUSTODIAL_ID]: INVESTMENT })
      mockPersistentState = signed
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.recordInvoice("lnbc25m1investment"))

      expect(applyLastUpdate(signed)?.cardInvestmentByAccountId).toEqual({
        [CUSTODIAL_ID]: {
          ...INVESTMENT,
          invoice: { paymentRequest: "lnbc25m1investment", issuedAt: NOW },
        },
      })
    })

    it("replaces the invoice issued before", () => {
      const signed = stateWith({
        [CUSTODIAL_ID]: {
          ...INVESTMENT,
          invoice: { paymentRequest: "lnbc1old", issuedAt: NOW - 1 },
        },
      })
      mockPersistentState = signed
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.recordInvoice("lnbc1new"))

      expect(applyLastUpdate(signed)?.cardInvestmentByAccountId?.[CUSTODIAL_ID]).toEqual({
        ...INVESTMENT,
        invoice: { paymentRequest: "lnbc1new", issuedAt: NOW },
      })
    })

    /** An invoice with no investment behind it is not this record's to invent. */
    it("changes nothing when nothing was signed", () => {
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.recordInvoice("lnbc25m1investment"))

      expect(applyLastUpdate(baseState)).toBe(baseState)
    })
  })

  describe("the account the record is filed under", () => {
    it("is the custodial account's server id, once known", () => {
      const { result } = renderHook(() => useCardInvestmentProgress())
      expect(result.current.accountId).toBe(CUSTODIAL_ID)
      expect(result.current.isAccountResolved).toBe(true)

      custodialSession()
      expect(
        renderHook(() => useCardInvestmentProgress()).result.current.isAccountResolved,
      ).toBe(true)
    })

    it("is unknown while the custodial id has not been served", () => {
      custodialSession(null)

      const { result } = renderHook(() => useCardInvestmentProgress())
      expect(result.current.accountId).toBeNull()
      expect(result.current.isAccountResolved).toBe(false)
    })
  })

  describe("clear", () => {
    it("forgets the active account's investment", () => {
      const signed = stateWith({ [CUSTODIAL_ID]: INVESTMENT })
      mockPersistentState = signed
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.clear())

      expect(applyLastUpdate(signed)?.cardInvestmentByAccountId).toEqual({})
    })

    it("leaves an unloaded store alone", () => {
      const { result } = renderHook(() => useCardInvestmentProgress())

      act(() => result.current.clear())

      expect(applyLastUpdate(undefined)).toBeUndefined()
    })
  })

  it("keeps the same callbacks across renders", () => {
    const { result, rerender } = renderHook(() => useCardInvestmentProgress())
    const first = result.current

    rerender({})

    expect(result.current.start).toBe(first.start)
    expect(result.current.recordInvoice).toBe(first.recordInvoice)
    expect(result.current.markPaid).toBe(first.markPaid)
    expect(result.current.clear).toBe(first.clear)
  })
})

describe("card investment payment arm", () => {
  const INVOICE = "lnbc25m1investment"
  const OTHER_INVOICE = "lnbc1someoneelse"

  /** The arm is module state and only spending it clears it, so each test starts from
   *  nothing armed by arming a throwaway invoice and spending that. */
  afterEach(() => {
    armCardInvestmentPayment("lnbc1throwaway")
    consumeCardInvestmentPayment("lnbc1throwaway")
  })

  it("is not armed until the transfer step arms it", () => {
    expect(consumeCardInvestmentPayment(INVOICE)).toBe(false)
  })

  /** One arm records at most one payment: the receipt that spends it leaves nothing for
   *  the next payment, whatever that one is for. */
  it("is spent by the receipt that settles the armed invoice", () => {
    armCardInvestmentPayment(INVOICE)

    expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
    expect(consumeCardInvestmentPayment(INVOICE)).toBe(false)
  })

  /** The send flow stays open to other destinations while the transfer step sits
   *  underneath; a payment to anyone else in that window is not the investment, and
   *  the investment's own payment may still follow. */
  it("is neither spent nor dropped by a receipt for another invoice", () => {
    armCardInvestmentPayment(INVOICE)

    expect(consumeCardInvestmentPayment(OTHER_INVOICE)).toBe(false)
    expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
  })

  it("ignores a receipt that names no invoice", () => {
    armCardInvestmentPayment(INVOICE)

    expect(consumeCardInvestmentPayment(undefined)).toBe(false)
    expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
  })

  it("recognises the invoice whichever case the send flow hands it back in", () => {
    armCardInvestmentPayment(INVOICE.toUpperCase())

    expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
  })

  /** A step deciding what an answer about the invoice means must be able to ask
   *  without spending the arm the receipt still needs. */
  it("can be asked about without being spent", () => {
    expect(isCardInvestmentPaymentArmed(INVOICE)).toBe(false)

    armCardInvestmentPayment(INVOICE)

    expect(isCardInvestmentPaymentArmed(INVOICE.toUpperCase())).toBe(true)
    expect(isCardInvestmentPaymentArmed(OTHER_INVOICE)).toBe(false)
    expect(isCardInvestmentPaymentArmed(undefined)).toBe(false)
    expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
  })

  describe("useConsumeCardInvestmentPayment", () => {
    it("answers false when nothing armed the payment", () => {
      const { result } = renderHook(() => useConsumeCardInvestmentPayment(INVOICE))

      expect(result.current).toBe(false)
    })

    it("answers false for a receipt that settled nothing armed", () => {
      armCardInvestmentPayment(INVOICE)

      const { result } = renderHook(() => useConsumeCardInvestmentPayment(OTHER_INVOICE))

      expect(result.current).toBe(false)
      expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
    })

    /** Spent on the first render and held: a later render must not read the arm again,
     *  or one set in the meantime would be credited to this receipt. */
    it("spends the arm once and keeps the answer for its lifetime", () => {
      armCardInvestmentPayment(INVOICE)

      const { result, rerender } = renderHook(() =>
        useConsumeCardInvestmentPayment(INVOICE),
      )
      armCardInvestmentPayment(INVOICE)
      rerender({})

      expect(result.current).toBe(true)
      expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
    })

    it("does not credit a receipt with an arm set after it first rendered", () => {
      const { result, rerender } = renderHook(() =>
        useConsumeCardInvestmentPayment(INVOICE),
      )
      armCardInvestmentPayment(INVOICE)
      rerender({})

      expect(result.current).toBe(false)
      expect(consumeCardInvestmentPayment(INVOICE)).toBe(true)
    })
  })
})
