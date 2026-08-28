import {
  getCompletedQuizIds,
  withCompletedQuizId,
} from "@app/store/persistent-state/quiz-completions"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { DefaultAccountId } from "@app/types/wallet"

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("getCompletedQuizIds", () => {
  it("returns an empty list as the ultimate default", () => {
    expect(getCompletedQuizIds(baseState)).toEqual([])
  })

  it("returns the per-account list when set for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      completedQuizIdsByAccountId: {
        "self-custodial-1": ["whatIsBitcoin", "sat"],
        "self-custodial-2": ["whereBitcoinExist"],
      },
    }

    expect(getCompletedQuizIds(state)).toEqual(["whatIsBitcoin", "sat"])
  })

  it("falls back to the custodial slot when activeAccountId is undefined", () => {
    const state: PersistentState = {
      ...baseState,
      completedQuizIdsByAccountId: {
        [DefaultAccountId.Custodial]: ["whatIsBitcoin"],
      },
    }

    expect(getCompletedQuizIds(state)).toEqual(["whatIsBitcoin"])
  })

  it("isolates progress per active account", () => {
    const map = {
      "self-custodial-1": ["whatIsBitcoin"],
      "self-custodial-2": ["sat"],
    }

    expect(
      getCompletedQuizIds({
        ...baseState,
        activeAccountId: "self-custodial-1",
        completedQuizIdsByAccountId: map,
      }),
    ).toEqual(["whatIsBitcoin"])

    expect(
      getCompletedQuizIds({
        ...baseState,
        activeAccountId: "self-custodial-2",
        completedQuizIdsByAccountId: map,
      }),
    ).toEqual(["sat"])
  })

  it("returns an empty list when the map exists but has no entry for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-3",
      completedQuizIdsByAccountId: { "self-custodial-1": ["whatIsBitcoin"] },
    }

    expect(getCompletedQuizIds(state)).toEqual([])
  })
})

describe("withCompletedQuizId", () => {
  it("creates the per-account map when absent and records the quiz for the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
    }

    const next = withCompletedQuizId(state, "whatIsBitcoin")

    expect(next.completedQuizIdsByAccountId).toEqual({
      "self-custodial-1": ["whatIsBitcoin"],
    })
  })

  it("appends to the existing list, preserving earlier progress", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      completedQuizIdsByAccountId: { "self-custodial-1": ["whatIsBitcoin"] },
    }

    const next = withCompletedQuizId(state, "sat")

    expect(next.completedQuizIdsByAccountId).toEqual({
      "self-custodial-1": ["whatIsBitcoin", "sat"],
    })
  })

  it("preserves entries for other accounts and updates only the active id", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-2",
      completedQuizIdsByAccountId: {
        "self-custodial-1": ["whatIsBitcoin"],
        "self-custodial-2": [],
      },
    }

    const next = withCompletedQuizId(state, "sat")

    expect(next.completedQuizIdsByAccountId).toEqual({
      "self-custodial-1": ["whatIsBitcoin"],
      "self-custodial-2": ["sat"],
    })
  })

  it("returns the same state when the quiz is already recorded", () => {
    const state: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      completedQuizIdsByAccountId: { "self-custodial-1": ["whatIsBitcoin"] },
    }

    expect(withCompletedQuizId(state, "whatIsBitcoin")).toBe(state)
  })

  it("uses the custodial slot when activeAccountId is undefined", () => {
    const next = withCompletedQuizId(baseState, "whatIsBitcoin")

    expect(next.completedQuizIdsByAccountId).toEqual({
      [DefaultAccountId.Custodial]: ["whatIsBitcoin"],
    })
  })

  it("does not mutate the input state", () => {
    const original: PersistentState = {
      ...baseState,
      activeAccountId: "self-custodial-1",
      completedQuizIdsByAccountId: { "self-custodial-1": ["whatIsBitcoin"] },
    }
    const snapshot = JSON.parse(JSON.stringify(original))

    withCompletedQuizId(original, "sat")

    expect(original).toEqual(snapshot)
  })
})
