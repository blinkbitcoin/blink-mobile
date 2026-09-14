import { act, renderHook } from "@testing-library/react-native"

import { useSelfCustodialAccountMode } from "@app/self-custodial/hooks/use-self-custodial-account-mode"
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
  schemaVersion: 21,
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

  describe("accountMode (read)", () => {
    it("returns the active self-custodial account's mode", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-1",
        selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Anon },
      }

      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.accountMode).toBe(AccountMode.Anon)
      expect(result.current.isAnonMode).toBe(true)
    })

    it("reports a non-anon mode with isAnonMode false", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-1",
        selfCustodialAccountModeByAccountId: { "self-custodial-1": AccountMode.Enhanced },
      }

      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.accountMode).toBe(AccountMode.Enhanced)
      expect(result.current.isAnonMode).toBe(false)
    })

    it("returns null mode when the account has not chosen yet", () => {
      mockPersistentState = { ...baseState, activeAccountId: "self-custodial-1" }

      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.accountMode).toBeNull()
      expect(result.current.isAnonMode).toBe(false)
    })
  })

  describe("getModeFor (read by id)", () => {
    it("returns the stored mode for any account id, active or not", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-1",
        selfCustodialAccountModeByAccountId: {
          "self-custodial-2": AccountMode.Anon,
        },
      }

      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.getModeFor("self-custodial-2")).toBe(AccountMode.Anon)
      expect(result.current.getModeFor("self-custodial-1")).toBeNull()
    })

    it("returns null when nothing has been stored yet", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      expect(result.current.getModeFor("self-custodial-1")).toBeNull()
    })
  })

  describe("setActiveAccountMode (switch)", () => {
    it("the captured updater writes the mode for the active self-custodial account", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      act(() => result.current.setActiveAccountMode(AccountMode.Enhanced))

      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater({ ...baseState, activeAccountId: "self-custodial-1" })

      expect(next.selfCustodialAccountModeByAccountId).toEqual({
        "self-custodial-1": AccountMode.Enhanced,
      })
    })

    it("the captured updater leaves state untouched when no self-custodial account is active", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      act(() => result.current.setActiveAccountMode(AccountMode.Enhanced))

      const updater = mockUpdateState.mock.calls[0][0]
      const custodialState = { ...baseState }

      expect(updater(custodialState)).toBe(custodialState)
    })

    it("the captured updater returns a falsy value when prev is undefined (no write)", () => {
      const { result } = renderHook(() => useSelfCustodialAccountMode())

      act(() => result.current.setActiveAccountMode(AccountMode.Anon))

      const updater = mockUpdateState.mock.calls[0][0]

      expect(updater(undefined)).toBeFalsy()
    })
  })
})
