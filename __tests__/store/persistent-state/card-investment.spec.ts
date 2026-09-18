import {
  CARD_INVESTMENT_LIFETIME_MS,
  getCardInvestment,
  withCardInvestment,
  withoutCardInvestment,
} from "@app/store/persistent-state/card-investment"
import { defaultPersistentState } from "@app/store/persistent-state/state-migrations"

const ACCOUNT_ID = "account-1"
const OTHER_ACCOUNT_ID = "account-2"

const NOW = 1_757_800_000_000
const AN_HOUR_MS = 60 * 60 * 1000

const INVESTMENT = {
  selectedAmountUsd: 25000,
  settlementSats: 31_704_000,
  signedAt: NOW - AN_HOUR_MS,
}
const OTHER_INVESTMENT = { selectedAmountUsd: 1000, signedAt: NOW - AN_HOUR_MS }
const INVITATION = { invitedAt: NOW - AN_HOUR_MS }

describe("getCardInvestment", () => {
  it("is null when the account never signed for one", () => {
    expect(getCardInvestment(defaultPersistentState, ACCOUNT_ID, NOW)).toBeNull()
  })

  it("reads the entry stored for the given account", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: {
        [ACCOUNT_ID]: INVESTMENT,
        [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT,
      },
    }

    expect(getCardInvestment(state, ACCOUNT_ID, NOW)).toEqual(INVESTMENT)
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

    expect(getCardInvestment(stateWith(0), ACCOUNT_ID, NOW)).toBeNull()
    expect(getCardInvestment(stateWith(-1), ACCOUNT_ID, NOW)).toBeNull()
    expect(getCardInvestment(stateWith(Number.NaN), ACCOUNT_ID, NOW)).toBeNull()
    expect(getCardInvestment(stateWith(1000), ACCOUNT_ID, NOW)).toEqual({
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

    expect(getCardInvestment(state, ACCOUNT_ID, NOW)).toBeNull()
  })

  /** The agreement and the link to pay it are good for a day; a record older than that
   *  would point at a step whose document has lapsed, so it lapses with it. */
  describe("a day after its latest moment", () => {
    const stateWith = (record: object) => ({
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: record as typeof INVESTMENT },
    })
    const justBefore = NOW + CARD_INVESTMENT_LIFETIME_MS - AN_HOUR_MS - 1
    const onTheDot = NOW + CARD_INVESTMENT_LIFETIME_MS - AN_HOUR_MS

    it("reads an invitation until then, and nothing after", () => {
      expect(getCardInvestment(stateWith(INVITATION), ACCOUNT_ID, justBefore)).toEqual(
        INVITATION,
      )
      expect(getCardInvestment(stateWith(INVITATION), ACCOUNT_ID, onTheDot)).toBeNull()
    })

    it("reads a signed investment until then, and nothing after", () => {
      expect(getCardInvestment(stateWith(INVESTMENT), ACCOUNT_ID, justBefore)).toEqual(
        INVESTMENT,
      )
      expect(getCardInvestment(stateWith(INVESTMENT), ACCOUNT_ID, onTheDot)).toBeNull()
    })

    /** An invoice issued near the end of the day is paid after it; a record that lapsed
     *  in between would leave that payment with nothing to be recorded on, so the invoice
     *  is a moment of its own. */
    it("counts an investment with an invoice from the invoice, not the signature", () => {
      const invoiced = {
        ...INVESTMENT,
        invoice: { paymentRequest: "lnbc1investment", issuedAt: NOW },
      }

      expect(getCardInvestment(stateWith(invoiced), ACCOUNT_ID, onTheDot)).toEqual(
        invoiced,
      )
      expect(
        getCardInvestment(
          stateWith(invoiced),
          ACCOUNT_ID,
          NOW + CARD_INVESTMENT_LIFETIME_MS,
        ),
      ).toBeNull()
    })

    /** The payment is a later moment than the signature, so the welcome is counted
     *  from it rather than lapsing with the signature it followed. */
    it("counts a paid investment from the payment, not the signature", () => {
      const paid = { ...INVESTMENT, paidAt: NOW }

      expect(getCardInvestment(stateWith(paid), ACCOUNT_ID, onTheDot)).toEqual(paid)
      expect(
        getCardInvestment(stateWith(paid), ACCOUNT_ID, NOW + CARD_INVESTMENT_LIFETIME_MS),
      ).toBeNull()
    })
  })

  it("reads an invitation not yet signed", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: INVITATION },
    }

    expect(getCardInvestment(state, ACCOUNT_ID, NOW)).toEqual(INVITATION)
  })

  /** A record that is neither signed nor an opened invitation says nothing about where
   *  the investor is, so nothing is built on it. */
  it("reads nothing from an invitation without a moment it was opened at", () => {
    const stateWith = (record: object) => ({
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: record as typeof INVITATION },
    })

    expect(
      getCardInvestment(stateWith({ invitedAt: Number.NaN }), ACCOUNT_ID, NOW),
    ).toBeNull()
    expect(getCardInvestment(stateWith({}), ACCOUNT_ID, NOW)).toBeNull()
  })

  /** The record comes off disk; whatever is there must be read as nothing, not thrown on. */
  it("reads nothing from an entry that is not a record at all", () => {
    const stateWith = (entry: unknown) => ({
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [ACCOUNT_ID]: entry as typeof INVITATION },
    })

    expect(getCardInvestment(stateWith("signed"), ACCOUNT_ID, NOW)).toBeNull()
    expect(getCardInvestment(stateWith(1), ACCOUNT_ID, NOW)).toBeNull()
    expect(getCardInvestment(stateWith(null), ACCOUNT_ID, NOW)).toBeNull()
  })

  /** One investor's investment must never show on another's home. */
  it("does not read another account's entry", () => {
    const state = {
      ...defaultPersistentState,
      cardInvestmentByAccountId: { [OTHER_ACCOUNT_ID]: OTHER_INVESTMENT },
    }

    expect(getCardInvestment(state, ACCOUNT_ID, NOW)).toBeNull()
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

    expect(getCardInvestment(next, ACCOUNT_ID, NOW)).toEqual(INVESTMENT)
  })

  it("replaces an invitation with the investment signed on it", () => {
    const state = withCardInvestment(defaultPersistentState, ACCOUNT_ID, INVITATION)

    const next = withCardInvestment(state, ACCOUNT_ID, INVESTMENT)

    expect(getCardInvestment(next, ACCOUNT_ID, NOW)).toEqual(INVESTMENT)
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
    expect(getCardInvestment(next, ACCOUNT_ID, NOW)).toBeNull()
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
