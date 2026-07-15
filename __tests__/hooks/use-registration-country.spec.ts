import { renderHook, act } from "@testing-library/react-hooks"

import { getFirstSeenCountryCode } from "@app/store/persistent-state/first-seen-country"
import { PersistentState } from "@app/store/persistent-state/state-migrations"

const mockLogError = jest.fn()

const mockParsePhoneNumber = jest.fn()
jest.mock("libphonenumber-js/mobile", () => ({
  ...jest.requireActual("libphonenumber-js/mobile"),
  parsePhoneNumber: (...args: unknown[]) => mockParsePhoneNumber(...args),
}))

const mockResolveIpCountryCode = jest.fn()
const mockDetectAnonymizingIp = jest.fn()
jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: (...args: unknown[]) => mockResolveIpCountryCode(...args),
  detectAnonymizingIpCached: (...args: unknown[]) => mockDetectAnonymizingIp(...args),
}))

jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

const mockLogPersisted = jest.fn()
const mockLogDeferred = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logRegistrationCountryPersisted: (...args: unknown[]) => mockLogPersisted(...args),
  logRegistrationCountryPersistDeferred: (...args: unknown[]) => mockLogDeferred(...args),
}))

const mockUseSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: (...args: unknown[]) => mockUseSettingsScreenQuery(...args),
}))

const mockUpdateState = jest.fn()
let mockPersistentState: PersistentState

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: mockUpdateState,
  }),
}))

import { useRegistrationCountry } from "@app/hooks/use-registration-country"

const baseState: PersistentState = {
  schemaVersion: 14,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

/** Applies the captured updaters so assertions can inspect the persisted result. */
const persistedResult = (): PersistentState | undefined =>
  mockUpdateState.mock.calls.reduce(
    (state, [updater]) => updater(state),
    mockPersistentState as PersistentState | undefined,
  )

describe("useRegistrationCountry", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockResolveIpCountryCode.mockResolvedValue(undefined)
    mockDetectAnonymizingIp.mockResolvedValue(false)
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })
    mockParsePhoneNumber.mockImplementation(
      jest.requireActual("libphonenumber-js/mobile").parsePhoneNumber,
    )
    mockPersistentState = baseState
  })

  it("uses the phone country without any IP lookup", async () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
      loading: false,
    })

    const { result } = renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(result.current.countryCode).toBe("DE")
    expect(result.current.loading).toBe(false)
    expect(result.current.trusted).toBe(true)
    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
  })

  it("persists the phone country as the first-seen country", async () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
      loading: false,
    })

    renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(getFirstSeenCountryCode(persistedResult() as PersistentState)).toBe("DE")
    const updater = mockUpdateState.mock.calls[0][0]
    expect(updater(undefined)).toBeUndefined()
    expect(mockLogPersisted).toHaveBeenCalledWith({ countryCode: "DE", source: "phone" })
  })

  it("ignores an IP resolution that lands after unmount", async () => {
    let resolveLookup: (code: string | undefined) => void = () => {}
    mockResolveIpCountryCode.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve
      }),
    )

    const { unmount } = renderHook(() => useRegistrationCountry())
    unmount()

    await act(async () => {
      resolveLookup("HK")
    })

    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("prefers the phone country over a stale persisted first-seen country and refreshes it", async () => {
    mockPersistentState = { ...baseState, firstSeenCountryCode: "PL" }
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
      loading: false,
    })

    const { result } = renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(result.current.countryCode).toBe("DE")
    expect(getFirstSeenCountryCode(persistedResult() as PersistentState)).toBe("DE")
  })

  it("uses the persisted first-seen country without any IP lookup when there is no phone", async () => {
    mockPersistentState = { ...baseState, firstSeenCountryCode: "SV" }

    const { result } = renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(result.current.countryCode).toBe("SV")
    expect(result.current.loading).toBe(false)
    expect(result.current.trusted).toBe(true)
    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("resolves and persists the first-seen country once when neither phone nor persisted value exists", async () => {
    mockResolveIpCountryCode.mockResolvedValue("SV")

    const { result } = renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(result.current.countryCode).toBe("SV")
    expect(result.current.trusted).toBe(true)
    expect(mockResolveIpCountryCode).toHaveBeenCalledTimes(1)
    expect(getFirstSeenCountryCode(persistedResult() as PersistentState)).toBe("SV")
    expect(mockLogPersisted).toHaveBeenCalledWith({ countryCode: "SV", source: "ip" })
  })

  it("does not overwrite a first-seen country persisted concurrently by another mount", async () => {
    mockResolveIpCountryCode.mockResolvedValue("DE")

    renderHook(() => useRegistrationCountry())

    await act(async () => {})

    const updater = mockUpdateState.mock.calls[0][0]
    expect(
      getFirstSeenCountryCode(updater({ ...baseState, firstSeenCountryCode: "SV" })),
    ).toBe("SV")
    expect(updater(undefined)).toBeUndefined()
  })

  it("uses a VPN-flagged country for the session without persisting it", async () => {
    mockResolveIpCountryCode.mockResolvedValue("DE")
    mockDetectAnonymizingIp.mockResolvedValue(true)

    const { result } = renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(result.current.countryCode).toBe("DE")
    expect(result.current.trusted).toBe(true)
    expect(mockUpdateState).not.toHaveBeenCalled()
    expect(mockLogDeferred).toHaveBeenCalledWith({ countryCode: "DE" })
    expect(mockLogPersisted).not.toHaveBeenCalled()
  })

  it("persists the first-seen country when anonymity detection is unavailable", async () => {
    mockResolveIpCountryCode.mockResolvedValue("SV")
    mockDetectAnonymizingIp.mockResolvedValue(undefined)

    renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(getFirstSeenCountryCode(persistedResult() as PersistentState)).toBe("SV")
  })

  it("persists nothing and reports untrusted when the IP lookup fails", async () => {
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(result.current.countryCode).toBeUndefined()
    expect(result.current.loading).toBe(false)
    expect(result.current.trusted).toBe(false)
    expect(mockUpdateState).not.toHaveBeenCalled()
  })

  it("stays loading and does not resolve IP while the settings query is loading", () => {
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined, loading: true })

    const { result } = renderHook(() => useRegistrationCountry())

    expect(result.current.loading).toBe(true)
    expect(result.current.countryCode).toBeUndefined()
    expect(result.current.trusted).toBe(false)
    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
  })

  it("falls through to the persisted country when the phone cannot be parsed", async () => {
    mockPersistentState = { ...baseState, firstSeenCountryCode: "SV" }
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "invalid-phone" } },
      loading: false,
    })

    const { result } = renderHook(() => useRegistrationCountry())

    await act(async () => {})

    expect(result.current.countryCode).toBe("SV")
    expect(result.current.trusted).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "registration-country",
        context: expect.objectContaining({ source: "phone" }),
      }),
    )
  })
})
