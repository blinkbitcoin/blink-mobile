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
  schemaVersion: 18,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

describe("useSelfCustodialAccountMode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = { ...baseState }
  })

  describe("getAccountMode (read)", () => {
    it("returns the stored mode for the given account id", () => {
      mockPersistentState = {
        ...baseState,
        selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Anon },
      }
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.getAccountMode("self-custodial-1")).toBe(AccountMode.Anon)
    })

    it("returns undefined for an account that never passed the mode screen", () => {
      mockPersistentState = {
        ...baseState,
        selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Anon },
      }
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.getAccountMode("restored-without-mode")).toBeUndefined()
    })

    it("returns undefined when no account has ever stored a mode", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.getAccountMode("self-custodial-1")).toBeUndefined()
    })

    it("reads the mode of the requested account, not of the active one", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-1",
        selfCustodialAccountModeByAccountId: {
          "self-custodial-1": AccountMode.Enhanced,
          "provisioned-sc-2": AccountMode.Anon,
        },
      }
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.getAccountMode("provisioned-sc-2")).toBe(AccountMode.Anon)
    })
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
