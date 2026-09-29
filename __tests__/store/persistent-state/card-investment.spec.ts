import {
  getCardInvestment,
  withCardInvestment,
  withCardInvestmentsPrunedForLogout,
  withoutCardInvestment,
} from "@app/store/persistent-state/card-investment"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"

const ACCOUNT_ID = "account-1"
const OTHER_ACCOUNT_ID = "account-2"

const NOW = 1_757_800_000_000
const AN_HOUR_MS = 60 * 60 * 1000
const A_YEAR_MS = 365 * 24 * AN_HOUR_MS

const INVESTMENT = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: NOW - AN_HOUR_MS,
}
const OTHER_INVESTMENT = { selectedAmountUsd: 1000, signedAt: NOW - AN_HOUR_MS }
const INVOICE = { paymentRequest: "lnbc1investment", issuedAt: NOW }

describe("getCardInvestment", () => {
  it("is null when the account never signed for one", () => {
    expect(getCardInvestment(defaultPersistentState, ACCOUNT_ID)).toBeNull()
  })

  it("reads the entry stored for the given account", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: INVESTMENT,
        [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT,
      },
    }

    expect(getCardInvestment(state, ACCOUNT_ID)).toEqual(INVESTMENT)
  })

  /** A record the select screen could never have produced is not trusted: a bulletin
   *  built on it would nag with nowhere to go. */
  it("reads nothing from a record without a usable amount", () => {
    const stateWith = (selectedAmountUsd: number) => ({
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: { selectedAmountUsd, signedAt: NOW - AN_HOUR_MS },
      },
    })

    expect(getCardInvestment(stateWith(0), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(-1), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(Number.NaN), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(1000), ACCOUNT_ID)).toEqual({
      selectedAmountUsd: 1000,
      signedAt: NOW - AN_HOUR_MS,
    })
  })

  it("reads nothing from a signed record without a moment it was signed at", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: { selectedAmountUsd: 1000, signedAt: Number.NaN },
      },
    }

    expect(getCardInvestment(state, ACCOUNT_ID)).toBeNull()
  })

  /** The agreement is signed for good, and the record is what keeps a second one from
   *  being signed: it must not fall away with time, however long ago it was signed. */
  it("reads a record however old it is", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: { ...INVESTMENT, signedAt: NOW - A_YEAR_MS },
      },
    }

    expect(getCardInvestment(state, ACCOUNT_ID)).toEqual({
      ...INVESTMENT,
      signedAt: NOW - A_YEAR_MS,
    })
  })

  /** The record comes off disk; whatever is there must be read as nothing, not thrown on. */
  it("reads nothing from an entry that is not a record at all", () => {
    const stateWith = (entry: unknown) => ({
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: entry as typeof INVESTMENT },
    })

    expect(getCardInvestment(stateWith("signed"), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(1), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(null), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith({}), ACCOUNT_ID)).toBeNull()
  })

  /** One investor's investment must never show on another's home. */
  it("does not read another account's entry", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT },
    }

    expect(getCardInvestment(state, ACCOUNT_ID)).toBeNull()
  })
})

describe("withCardInvestment", () => {
  it("stores the investment under the given account and keeps the others", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT },
    }

    const next = withCardInvestment(state, ACCOUNT_ID, INVESTMENT)

    expect(next.cardInvestmentByAccountId).toEqual({
      [ACCOUNT_ID]: INVESTMENT,
      [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT,
    })
  })

  it("replaces an earlier investment of the same account", () => {
    const state = withCardInvestment(defaultPersistentState, ACCOUNT_ID, OTHER_INVESTMENT)

    const next = withCardInvestment(state, ACCOUNT_ID, INVESTMENT)

    expect(getCardInvestment(next, ACCOUNT_ID)).toEqual(INVESTMENT)
  })

  it("does not mutate the state it was given", () => {
    const state = { ...defaultPersistentState }

    withCardInvestment(state, ACCOUNT_ID, INVESTMENT)

    expect(state.cardInvestmentByAccountId).toBeUndefined()
  })
})

describe("withoutCardInvestment", () => {
  it("removes the given account's entry and keeps the others", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: INVESTMENT,
        [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT,
      },
    }

    const next = withoutCardInvestment(state, ACCOUNT_ID)

    expect(next.cardInvestmentByAccountId).toEqual({
      [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT,
    })
    expect(getCardInvestment(next, ACCOUNT_ID)).toBeNull()
  })

  /** Returning the same object lets a functional updater skip a write nothing changed. */
  it("returns the same state when there is nothing to remove", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT },
    }

    expect(withoutCardInvestment(state, ACCOUNT_ID)).toBe(state)
  })

  it("returns the same state when the account never signed for one", () => {
    const state = { ...defaultPersistentState }

    expect(withoutCardInvestment(state, ACCOUNT_ID)).toBe(state)
  })
})

describe("withCardInvestmentsPrunedForLogout", () => {
  it("carries nothing when no account ever signed", () => {
    expect(withCardInvestmentsPrunedForLogout(defaultPersistentState)).toEqual({})
  })

  /** A paid record's invoice is a payable claim on the account with nothing left to
   *  pay; it is the one piece not worth leaving on a shared phone. */
  it("drops the invoice from a paid record", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: { ...INVESTMENT, invoice: INVOICE, paidAt: NOW },
      },
    }

    expect(withCardInvestmentsPrunedForLogout(state)).toEqual({
      cardInvestmentByAccountId: { [ACCOUNT_ID]: { ...INVESTMENT, paidAt: NOW } },
    })
  })

  /** An unpaid invoice is what a payment that went through without a receipt is later
   *  found by, so it stays; a payment on its way is found by it too. */
  it("keeps the invoice of a record not yet paid", () => {
    const unpaid = { ...INVESTMENT, invoice: INVOICE }
    const paying = { ...OTHER_INVESTMENT, invoice: INVOICE, payingAt: NOW }
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: unpaid, [OTHER_ACCOUNT_ID]: paying },
    }

    expect(withCardInvestmentsPrunedForLogout(state)).toEqual({
      cardInvestmentByAccountId: { [ACCOUNT_ID]: unpaid, [OTHER_ACCOUNT_ID]: paying },
    })
  })

  it("keeps every account's record, paid or not", () => {
    const paid = { ...INVESTMENT, paidAt: NOW, welcomeDismissedAt: NOW }
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: paid,
        [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT,
      },
    }

    expect(withCardInvestmentsPrunedForLogout(state)).toEqual({
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: paid,
        [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT,
      },
    })
  })

  /** The entries come off disk, and a logout must never throw on one of them. */
  it("carries an entry that is not a record through untouched", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: null as unknown as typeof INVESTMENT },
    }

    expect(withCardInvestmentsPrunedForLogout(state)).toEqual({
      cardInvestmentByAccountId: { [ACCOUNT_ID]: null },
    })
  })

  it("does not mutate the state it was given", () => {
    const paid = { ...INVESTMENT, invoice: INVOICE, paidAt: NOW }
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: paid },
    }

    withCardInvestmentsPrunedForLogout(state)

    expect(state.cardInvestmentByAccountId[ACCOUNT_ID]).toBe(paid)
    expect(paid.invoice).toBe(INVOICE)
  })
})
