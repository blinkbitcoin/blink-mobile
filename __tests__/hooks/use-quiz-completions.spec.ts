import { act, renderHook } from "@testing-library/react-native"

import { useQuizCompletions } from "@app/hooks/use-quiz-completions"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const mockUpdateState = jest.fn()
let mockPersistentState: PersistentState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

const baseState: PersistentState = {
  schemaVersion: 20,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("useQuizCompletions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = { ...baseState }
  })

  describe("completedQuizIds (read)", () => {
    it("is empty when no quiz has been completed", () => {
      const { result } = renderHook(() => useQuizCompletions())

      expect(result.current.completedQuizIds).toEqual([])
    })

    it("reflects the active account's recorded quizzes", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-1",
        completedQuizIdsByAccountId: {
          "self-custodial-1": ["whatIsBitcoin"],
          "self-custodial-2": ["sat"],
        },
      }

      const { result } = renderHook(() => useQuizCompletions())

      expect(result.current.completedQuizIds).toEqual(["whatIsBitcoin"])
    })
  })

  describe("markQuizCompleted (write)", () => {
    it("calls updateState with a functional updater, not a direct value", () => {
      const { result } = renderHook(() => useQuizCompletions())

      act(() => result.current.markQuizCompleted("whatIsBitcoin"))

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      expect(typeof mockUpdateState.mock.calls[0][0]).toBe("function")
    })

    it("the captured updater records the quiz for the active account", () => {
      const { result } = renderHook(() => useQuizCompletions())

      act(() => result.current.markQuizCompleted("sat"))

      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater({
        ...baseState,
        activeAccountId: "self-custodial-1",
        completedQuizIdsByAccountId: { "self-custodial-1": ["whatIsBitcoin"] },
      })

      expect(next.completedQuizIdsByAccountId).toEqual({
        "self-custodial-1": ["whatIsBitcoin", "sat"],
      })
    })

    it("the captured updater returns a falsy value when prev is undefined (no write)", () => {
      const { result } = renderHook(() => useQuizCompletions())

      act(() => result.current.markQuizCompleted("whatIsBitcoin"))

      const updater = mockUpdateState.mock.calls[0][0]

      expect(updater(undefined)).toBeFalsy()
    })
  })
})
