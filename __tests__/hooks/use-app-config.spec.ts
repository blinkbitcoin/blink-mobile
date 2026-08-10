import { renderHook, act } from "@testing-library/react-native"

import { resolveGaloyInstanceOrDefault } from "@app/config"
import { useAppConfig } from "@app/hooks/use-app-config"

const mockReportError = jest.fn()
const mockUpdateState = jest.fn()

const mockSecureStore = new Map<string, string>()
const failSetFor = new Set<string>()
jest.mock("react-native-secure-key-store", () => ({
  __esModule: true,
  default: {
    get: (key: string) =>
      mockSecureStore.has(key)
        ? Promise.resolve(mockSecureStore.get(key))
        : Promise.reject(new Error(`key not found: ${key}`)),
    set: (key: string, value: string) => {
      if (failSetFor.has(key)) return Promise.reject(new Error("keystore locked"))
      mockSecureStore.set(key, value)
      return Promise.resolve(true)
    },
    remove: (key: string) => {
      mockSecureStore.delete(key)
      return Promise.resolve(true)
    },
  },
  ACCESSIBLE: {
    ALWAYS_THIS_DEVICE_ONLY: "ALWAYS_THIS_DEVICE_ONLY",
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  },
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: { galoyAuthToken: "", galoyInstance: { id: "Main" } },
    updateState: mockUpdateState,
  }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

// Applies the updater the way PersistentStateProvider would, so tests can see
// what the in-memory state became.
const applyLastUpdate = (state: Record<string, unknown>) =>
  mockUpdateState.mock.calls.map(([update]) => update(state)).at(-1)

describe("useAppConfig token persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSecureStore.clear()
    failSetFor.clear()
  })

  it("saveToken writes the token to the key store and into in-memory state", async () => {
    const { result } = renderHook(() => useAppConfig())

    await act(async () => {
      await result.current.saveToken("session-token")
    })

    expect(mockSecureStore.get("activeAuthToken")).toBe("session-token")
    expect(applyLastUpdate({ galoyAuthToken: "" })).toEqual({
      galoyAuthToken: "session-token",
    })
  })

  it('saveToken("") removes the key-store token', async () => {
    mockSecureStore.set("activeAuthToken", "session-token")
    const { result } = renderHook(() => useAppConfig())

    await act(async () => {
      await result.current.saveToken("")
    })

    expect(mockSecureStore.has("activeAuthToken")).toBe(false)
  })

  it("saveTokenAndInstance persists the token alongside the instance switch", async () => {
    const { result } = renderHook(() => useAppConfig())

    await act(async () => {
      await result.current.saveTokenAndInstance({
        token: "session-token",
        instance: resolveGaloyInstanceOrDefault({ id: "Main" }),
      })
    })

    expect(mockSecureStore.get("activeAuthToken")).toBe("session-token")
  })

  it("reports a rejected key-store write instead of resolving silently", async () => {
    failSetFor.add("activeAuthToken")
    const { result } = renderHook(() => useAppConfig())

    await act(async () => {
      await result.current.saveToken("session-token")
    })

    // The in-memory login proceeds for this session, but the failure to
    // persist is surfaced — otherwise the session would evaporate at next
    // launch with nothing recorded anywhere.
    expect(mockSecureStore.has("activeAuthToken")).toBe(false)
    expect(mockReportError).toHaveBeenCalledTimes(1)
    expect(mockReportError.mock.calls[0][0]).toBe("persist auth token")
    expect(applyLastUpdate({ galoyAuthToken: "" })).toEqual({
      galoyAuthToken: "session-token",
    })
  })
})
