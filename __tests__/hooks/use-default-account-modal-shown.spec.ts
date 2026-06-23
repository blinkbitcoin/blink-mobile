import { act, renderHook } from "@testing-library/react-native"

import { useDefaultAccountModalShown } from "@app/hooks/use-default-account-modal-shown"
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
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("useDefaultAccountModalShown", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = { ...baseState }
  })

  describe("defaultAccountModalShown (read)", () => {
    it("reflects false when the flag has never been set", () => {
      const { result } = renderHook(() => useDefaultAccountModalShown())

      expect(result.current.defaultAccountModalShown).toBe(false)
    })

    it("reflects true when the active account's flag is set", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-1",
        defaultAccountModalShownByAccountId: { "self-custodial-1": true },
      }

      const { result } = renderHook(() => useDefaultAccountModalShown())

      expect(result.current.defaultAccountModalShown).toBe(true)
    })
  })

  describe("markDefaultAccountModalShown (write)", () => {
    it("calls updateState with a functional updater, not a direct value", () => {
      const { result } = renderHook(() => useDefaultAccountModalShown())

      act(() => result.current.markDefaultAccountModalShown())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      expect(typeof mockUpdateState.mock.calls[0][0]).toBe("function")
    })

    it("the captured updater sets the flag for the active account", () => {
      const { result } = renderHook(() => useDefaultAccountModalShown())

      act(() => result.current.markDefaultAccountModalShown())

      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater({ ...baseState, activeAccountId: "self-custodial-1" })

      expect(next.defaultAccountModalShownByAccountId).toEqual({
        "self-custodial-1": true,
      })
    })

    it("the captured updater returns a falsy value when prev is undefined (no write)", () => {
      const { result } = renderHook(() => useDefaultAccountModalShown())

      act(() => result.current.markDefaultAccountModalShown())

      const updater = mockUpdateState.mock.calls[0][0]

      expect(updater(undefined)).toBeFalsy()
    })
  })
})
