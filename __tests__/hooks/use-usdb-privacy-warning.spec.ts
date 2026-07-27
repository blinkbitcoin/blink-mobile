import { act, renderHook } from "@testing-library/react-native"

import { useUsdbPrivacyWarning } from "@app/hooks/use-usdb-privacy-warning"
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

describe("useUsdbPrivacyWarning", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPersistentState = { ...baseState }
  })

  describe("isVisible", () => {
    it("shows the warning in an enabled context that has never acknowledged it", () => {
      const { result } = renderHook(() => useUsdbPrivacyWarning({ enabled: true }))

      expect(result.current.isVisible).toBe(true)
    })

    it("stays hidden outside a dollar context, even when unacknowledged", () => {
      const { result } = renderHook(() => useUsdbPrivacyWarning({ enabled: false }))

      expect(result.current.isVisible).toBe(false)
    })

    it("stays hidden once the active account has acknowledged it", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-1",
        usdbPrivacyWarningAcknowledgedByAccountId: { "self-custodial-1": true },
      }

      const { result } = renderHook(() => useUsdbPrivacyWarning({ enabled: true }))

      expect(result.current.isVisible).toBe(false)
    })

    it("still shows for an account that has not acknowledged it, when another has", () => {
      mockPersistentState = {
        ...baseState,
        activeAccountId: "self-custodial-2",
        usdbPrivacyWarningAcknowledgedByAccountId: { "self-custodial-1": true },
      }

      const { result } = renderHook(() => useUsdbPrivacyWarning({ enabled: true }))

      expect(result.current.isVisible).toBe(true)
    })
  })

  describe("acknowledge", () => {
    it("calls updateState with a functional updater, not a direct value", () => {
      const { result } = renderHook(() => useUsdbPrivacyWarning({ enabled: true }))

      act(() => result.current.acknowledge())

      expect(mockUpdateState).toHaveBeenCalledTimes(1)
      expect(typeof mockUpdateState.mock.calls[0][0]).toBe("function")
    })

    it("the captured updater sets the flag for the active account only", () => {
      const { result } = renderHook(() => useUsdbPrivacyWarning({ enabled: true }))

      act(() => result.current.acknowledge())

      const updater = mockUpdateState.mock.calls[0][0]
      const next = updater({
        ...baseState,
        activeAccountId: "self-custodial-2",
        usdbPrivacyWarningAcknowledgedByAccountId: { "self-custodial-1": true },
      })

      expect(next.usdbPrivacyWarningAcknowledgedByAccountId).toEqual({
        "self-custodial-1": true,
        "self-custodial-2": true,
      })
    })

    it("the captured updater returns a falsy value when prev is undefined (no write)", () => {
      const { result } = renderHook(() => useUsdbPrivacyWarning({ enabled: true }))

      act(() => result.current.acknowledge())

      const updater = mockUpdateState.mock.calls[0][0]

      expect(updater(undefined)).toBeFalsy()
    })
  })
})
