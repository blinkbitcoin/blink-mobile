import { act, renderHook } from "@testing-library/react-native"

import { useSelfCustodialAccountMode } from "@app/hooks/use-self-custodial-account-mode"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

const mockUpdateState = jest.fn()
let mockPersistentState: PersistentState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

const baseState: PersistentState = {
  schemaVersion: 17,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("useSelfCustodialAccountMode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = { ...baseState }
  })

  describe("setAccountMode (write)", () => {
    it("calls updateState with a functional updater, not a direct value", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      act(() => result.current.setAccountMode("self-custodial-1", AccountMode.Enhanced))

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      expect(typeof mockUpdateState.mock.calls[0][0]).toBe("function")
    })

    it("the captured updater writes the mode for the given account id", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      act(() => result.current.setAccountMode("self-custodial-1", AccountMode.Anon))

      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater(baseState)

      expect(next.selfCustodialAccountModeByAccountId).toEqual({
        "self-custodial-1": AccountMode.Anon,
      })
    })

    it("the captured updater returns a falsy value when prev is undefined (no write)", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      act(() => result.current.setAccountMode("self-custodial-1", AccountMode.Enhanced))

      const updater = mockUpdateState.mock.calls[0][0]

      expect(updater(undefined)).toBeFalsy()
    })
  })
})
