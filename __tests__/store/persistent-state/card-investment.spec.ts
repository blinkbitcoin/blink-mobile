import {
  getCardInvestment,
  withCardInvestment,
  withoutCardInvestment,
} from "@app/store/persistent-state/card-investment"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"

const ACCOUNT_ID = "account-1"
const OTHER_ACCOUNT_ID = "account-2"

const INVESTMENT = { selectedAmountUsd: 25000, settlementSats: 31_704_000 }
const OTHER_INVESTMENT = { selectedAmountUsd: 1000 }

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
      cardInvestmentByAccountId: { [ACCOUNT_ID]: { selectedAmountUsd } },
    })

    expect(getCardInvestment(stateWith(0), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(-1), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(Number.NaN), ACCOUNT_ID)).toBeNull()
    expect(getCardInvestment(stateWith(1000), ACCOUNT_ID)?.selectedAmountUsd).toBe(1000)
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
