import { renderHook, act } from "@testing-library/react-hooks"

import useDeviceLocation, {
  isBlockedCountry,
  useIpCountryCode,
  useIpCountryLookup,
  usePhoneCountryCode,
} from "@app/hooks/use-device-location"

const mockLogError = jest.fn()
const mockUpdateCountryCode = jest.fn()

const mockParsePhoneNumber = jest.fn()
jest.mock("libphonenumber-js/mobile", () => ({
  ...jest.requireActual("libphonenumber-js/mobile"),
  parsePhoneNumber: (...args: unknown[]) => mockParsePhoneNumber(...args),
}))

const mockResolveIpCountryCode = jest.fn()
let mockLookupGeneration = 0
let mockNotifyLookupReset: (() => void) | null = null
jest.mock("@app/utils/ip-country-lookup", () => ({
  resolveIpCountryCodeCached: (...args: unknown[]) => mockResolveIpCountryCode(...args),
  /** The hook subscribes to the session-start reset; `resetLookupGeneration` fires one. */
  subscribeToIpCountryLookup: (listener: () => void) => {
    mockNotifyLookupReset = listener
    return () => {
      mockNotifyLookupReset = null
    }
  },
  getIpCountryLookupGeneration: () => mockLookupGeneration,
}))

/** Stands in for a session start dropping the shared lookup, which is what makes an
 *  already-mounted consumer resolve again instead of keeping the last country. */
const resetLookupGeneration = () => {
  mockLookupGeneration += 1
  mockNotifyLookupReset?.()
}

jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  updateCountryCode: (...args: unknown[]) => mockUpdateCountryCode(...args),
}))

const mockUseApolloClient = jest.fn(() => ({ mockClient: true }))
jest.mock("@apollo/client", () => ({
  useApolloClient: () => mockUseApolloClient(),
}))

const mockUseCountryCodeQuery = jest.fn()
const mockUseSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useCountryCodeQuery: () => mockUseCountryCodeQuery(),
  useSettingsScreenQuery: (...args: unknown[]) => mockUseSettingsScreenQuery(...args),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

describe("useDeviceLocation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockResolveIpCountryCode.mockResolvedValue(undefined)
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined })
    mockParsePhoneNumber.mockImplementation(
      jest.requireActual("libphonenumber-js/mobile").parsePhoneNumber,
    )
  })

  it("should not expose any country code while loading", () => {
    mockUseCountryCodeQuery.mockReturnValue({ data: undefined, error: undefined })

    const { result } = renderHook(() => useDeviceLocation())

    expect(result.current.loading).toBe(true)
    expect(result.current.countryCode).toBeUndefined()
    expect(result.current.detectionFailed).toBe(false)
  })

  it("should resolve country from logged-in user phone without calling IP lookup", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("DE")
    expect(result.current.detectionFailed).toBe(false)
    expect(result.current.source).toBe("phone")
    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
  })

  it("should update Apollo cache when resolving from user phone", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "DE")
  })

  it("marks detection as failed when user phone cannot be parsed", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "invalid-phone" } },
    })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "phone" }),
      }),
    )
  })

  it("should fall back to SV when phone parses but returns no country", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+15555555555" } },
    })
    mockParsePhoneNumber.mockReturnValue({ country: undefined })

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockUpdateCountryCode).not.toHaveBeenCalled()
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "phone" }),
      }),
    )
  })

  it("should fall back to IP lookup when user has no phone", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: null } },
    })
    mockResolveIpCountryCode.mockResolvedValue("PL")

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")
    expect(result.current.detectionFailed).toBe(false)
    expect(result.current.source).toBe("ip")
    expect(mockResolveIpCountryCode).toHaveBeenCalled()
  })

  it("should fall back to IP lookup when user is not logged in", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue("JP")

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("JP")
  })

  it("should resolve to the IP lookup country code and never flash SV as intermediate value", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue("PL")

    const emittedValues: Array<{ countryCode: string | undefined; loading: boolean }> = []

    const { result } = renderHook(() => {
      const hook = useDeviceLocation()
      emittedValues.push({ countryCode: hook.countryCode, loading: hook.loading })
      return hook
    })

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")

    const visibleValues = emittedValues.filter((v) => !v.loading)
    for (const value of visibleValues) {
      expect(value.countryCode).not.toBe("SV")
    }

    const allCountryCodes = emittedValues.map((v) => v.countryCode)
    expect(allCountryCodes).not.toContain("SV")
  })

  it("uses the cached country and does not mark detection failed when all adapters return nothing", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "PL" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("PL")
    expect(result.current.detectionFailed).toBe(false)
  })

  it("marks detection failed when all adapters return nothing and no cached value exists", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: null },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
  })

  describe("anon mode", () => {
    it("resolves nothing and issues no lookup, even with a phone available", async () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })
      mockUseSettingsScreenQuery.mockReturnValue({
        data: { me: { phone: "+4915112345678" } },
      })

      const { result } = renderHook(() => useDeviceLocation())

      await act(async () => {})

      expect(result.current).toEqual({
        countryCode: undefined,
        loading: false,
        detectionFailed: false,
        source: undefined,
      })
      expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
      expect(mockParsePhoneNumber).not.toHaveBeenCalled()
    })

    it("does not run the IP fallback for a phone-less account", async () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })

      renderHook(() => useDeviceLocation())

      await act(async () => {})

      expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    })

    it("stays inert on a query error", () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: undefined,
        error: new Error("Apollo cache error"),
      })

      const { result } = renderHook(() => useDeviceLocation())

      expect(result.current.loading).toBe(false)
      expect(result.current.countryCode).toBeUndefined()
      expect(result.current.detectionFailed).toBe(false)
    })

    it("detects normally for a custodial flow even while Anon is active", async () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })
      mockResolveIpCountryCode.mockResolvedValue("DE")

      const { result } = renderHook(() => useDeviceLocation({ isCustodialFlow: true }))

      await act(async () => {})

      expect(result.current.countryCode).toBe("DE")
      expect(result.current.loading).toBe(false)
      expect(mockResolveIpCountryCode).toHaveBeenCalled()
    })

    /** The in-flight answer must not land on a mode not allowed to know it. */
    it("discards a lookup already in flight when Anon switches on", async () => {
      let resolveLookup: (code: string) => void = () => undefined
      mockResolveIpCountryCode.mockReturnValue(
        new Promise<string>((resolve) => {
          resolveLookup = resolve
        }),
      )
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })

      const { result, rerender } = renderHook(() => useDeviceLocation())

      expect(result.current.loading).toBe(true)

      mockIsAnonMode = true
      rerender()

      await act(async () => {
        resolveLookup("DE")
      })

      expect(result.current.countryCode).toBeUndefined()
      expect(result.current.loading).toBe(false)
    })

    it("re-arms loading for a fresh resolve when Anon switches off", async () => {
      mockIsAnonMode = true
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })
      mockResolveIpCountryCode.mockResolvedValue("DE")

      const { result, rerender } = renderHook(() => useDeviceLocation())

      expect(result.current.loading).toBe(false)

      mockIsAnonMode = false
      rerender()

      /** Not settled-without-a-country: the previous answer was discarded. */
      expect(result.current.loading).toBe(true)

      await act(async () => {})

      expect(result.current.countryCode).toBe("DE")
      expect(result.current.loading).toBe(false)
    })

    it("drops a country resolved before Anon switched on", async () => {
      mockUseCountryCodeQuery.mockReturnValue({
        data: { countryCode: "SV" },
        error: undefined,
      })
      mockResolveIpCountryCode.mockResolvedValue("DE")

      const { result, rerender } = renderHook(() => useDeviceLocation())

      await act(async () => {})
      expect(result.current.countryCode).toBe("DE")

      mockIsAnonMode = true
      rerender()

      expect(result.current.countryCode).toBeUndefined()
      expect(result.current.detectionFailed).toBe(false)
    })
  })

  it("marks detection failed on Apollo query error (falls back to SV)", () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: undefined,
      error: new Error("Apollo cache error"),
    })

    const { result } = renderHook(() => useDeviceLocation())

    expect(result.current.loading).toBe(false)
    expect(result.current.countryCode).toBe("SV")
    expect(result.current.detectionFailed).toBe(true)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "device-location",
        context: expect.objectContaining({ source: "country-code-query" }),
      }),
    )
  })

  it("should update Apollo cache when IP lookup succeeds", async () => {
    mockUseCountryCodeQuery.mockReturnValue({
      data: { countryCode: "SV" },
      error: undefined,
    })
    mockResolveIpCountryCode.mockResolvedValue("DE")

    renderHook(() => useDeviceLocation())

    await act(async () => {})

    expect(mockUpdateCountryCode).toHaveBeenCalledWith(expect.anything(), "DE")
  })
})

describe("useIpCountryCode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockResolveIpCountryCode.mockResolvedValue(undefined)
  })

  it("does not call IP lookup while disabled", () => {
    const { result } = renderHook(() => useIpCountryCode(false))

    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    expect(result.current).toBeUndefined()
  })

  it("resolves the country from the adapter chain when enabled", async () => {
    mockResolveIpCountryCode.mockResolvedValue("HK")

    const { result } = renderHook(() => useIpCountryCode(true))

    await act(async () => {})

    expect(mockResolveIpCountryCode).toHaveBeenCalled()
    expect(result.current).toBe("HK")
  })

  it("stays undefined when all adapters return nothing", async () => {
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useIpCountryCode(true))

    await act(async () => {})

    expect(result.current).toBeUndefined()
  })
})

describe("useIpCountryLookup", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockResolveIpCountryCode.mockResolvedValue(undefined)
  })

  it("reports settled without a lookup while disabled", () => {
    const { result } = renderHook(() => useIpCountryLookup(false))

    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
  })

  it("reports settled without a lookup in Anon Mode", () => {
    mockIsAnonMode = true

    const { result } = renderHook(() => useIpCountryLookup(true))

    expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
  })

  it("stays unsettled while the lookup is in flight", () => {
    mockResolveIpCountryCode.mockReturnValue(new Promise(() => {}))

    const { result } = renderHook(() => useIpCountryLookup(true))

    expect(result.current).toEqual({ countryCode: undefined, isSettled: false })
  })

  it("settles with the country when the lookup resolves", async () => {
    mockResolveIpCountryCode.mockResolvedValue("HK")

    const { result } = renderHook(() => useIpCountryLookup(true))

    await act(async () => {})

    expect(result.current).toEqual({ countryCode: "HK", isSettled: true })
  })

  it("settles without a country when every adapter fails", async () => {
    mockResolveIpCountryCode.mockResolvedValue(undefined)

    const { result } = renderHook(() => useIpCountryLookup(true))

    await act(async () => {})

    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
  })

  describe("a session-start reset", () => {
    /**
     * The reset exists to drop the previous session's answer. Reporting the old country as
     * settled when the fresh lookup comes back empty is the cross-session latch it was added
     * to remove, and the consumers that gate on `isSettled` cannot tell the two apart.
     */
    it("drops the previous country when the re-lookup finds none", async () => {
      mockResolveIpCountryCode.mockResolvedValue("HK")
      const { result } = renderHook(() => useIpCountryLookup(true))
      await act(async () => {})
      expect(result.current).toEqual({ countryCode: "HK", isSettled: true })

      mockResolveIpCountryCode.mockResolvedValue(undefined)
      await act(async () => {
        resetLookupGeneration()
      })

      expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
    })

    it("takes the new country when the re-lookup finds one", async () => {
      mockResolveIpCountryCode.mockResolvedValue("HK")
      const { result } = renderHook(() => useIpCountryLookup(true))
      await act(async () => {})

      mockResolveIpCountryCode.mockResolvedValue("SV")
      await act(async () => {
        resetLookupGeneration()
      })

      expect(result.current).toEqual({ countryCode: "SV", isSettled: true })
    })

    /** Unsettling is what makes the gates wait rather than answer from the old country. */
    it("goes back to unsettled while the re-lookup is in flight", async () => {
      mockResolveIpCountryCode.mockResolvedValue("HK")
      const { result } = renderHook(() => useIpCountryLookup(true))
      await act(async () => {})

      mockResolveIpCountryCode.mockReturnValue(new Promise(() => {}))
      act(() => {
        resetLookupGeneration()
      })

      expect(result.current.isSettled).toBe(false)
    })
  })

  it("discards a lookup still in flight when it gets disabled and relooks up on re-enable", async () => {
    let resolveLookup: (code: string | undefined) => void = () => {}
    mockResolveIpCountryCode.mockReturnValue(
      new Promise((resolve) => {
        resolveLookup = resolve
      }),
    )

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useIpCountryLookup(enabled),
      { initialProps: { enabled: true } },
    )
    rerender({ enabled: false })

    await act(async () => {
      resolveLookup("HK")
    })

    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
    expect(mockResolveIpCountryCode).toHaveBeenCalledTimes(1)

    mockResolveIpCountryCode.mockResolvedValue("DE")
    rerender({ enabled: true })
    await act(async () => {})

    expect(mockResolveIpCountryCode).toHaveBeenCalledTimes(2)
    expect(result.current).toEqual({ countryCode: "DE", isSettled: true })
  })

  it("stops reporting the country once the lookup disables", async () => {
    mockResolveIpCountryCode.mockResolvedValue("KP")

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useIpCountryLookup(enabled),
      { initialProps: { enabled: true } },
    )
    await act(async () => {})
    expect(result.current).toEqual({ countryCode: "KP", isSettled: true })

    rerender({ enabled: false })

    expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
  })

  /** Anon overrides the caller, so no surface can leak a region through this hook. */
  describe("anon mode", () => {
    it("skips the lookup even when the caller enables it", async () => {
      mockIsAnonMode = true
      mockResolveIpCountryCode.mockResolvedValue("HK")

      const { result } = renderHook(() => useIpCountryLookup(true))

      await act(async () => {})

      expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
      expect(mockResolveIpCountryCode).not.toHaveBeenCalled()
    })

    it("clears a country it had already resolved when Anon switches on", async () => {
      mockResolveIpCountryCode.mockResolvedValue("HK")

      const { result, rerender } = renderHook(() => useIpCountryLookup(true))

      await act(async () => {})
      expect(result.current.countryCode).toBe("HK")

      mockIsAnonMode = true
      rerender()

      expect(result.current).toEqual({ countryCode: undefined, isSettled: true })
    })

    it("runs the lookup again once Anon switches off", async () => {
      mockIsAnonMode = true
      mockResolveIpCountryCode.mockResolvedValue("HK")

      const { result, rerender } = renderHook(() => useIpCountryLookup(true))

      await act(async () => {})
      expect(mockResolveIpCountryCode).not.toHaveBeenCalled()

      mockIsAnonMode = false
      rerender()

      await act(async () => {})

      expect(result.current).toEqual({ countryCode: "HK", isSettled: true })
    })
  })
})

describe("usePhoneCountryCode", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsAnonMode = false
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined })
    mockParsePhoneNumber.mockImplementation(
      jest.requireActual("libphonenumber-js/mobile").parsePhoneNumber,
    )
  })

  it("resolves the country from the user phone", () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBe("DE")
  })

  it("returns undefined when the user has no phone", () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: null } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBeUndefined()
  })

  it("returns undefined when the phone cannot be parsed", () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "invalid-phone" } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBeUndefined()
  })

  it("resolves nothing in Anon Mode even with a cached phone", () => {
    mockIsAnonMode = true
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { phone: "+4915112345678" } },
    })

    const { result } = renderHook(() => usePhoneCountryCode())

    expect(result.current).toBeUndefined()
    expect(mockParsePhoneNumber).not.toHaveBeenCalled()
  })
})

describe("isBlockedCountry", () => {
  it("returns true when country is in the blocked list", () => {
    expect(isBlockedCountry("US", ["US", "CN"])).toBe(true)
  })

  it("is case-insensitive", () => {
    expect(isBlockedCountry("us", ["US"])).toBe(true)
  })

  it("returns false when country is not in the blocked list", () => {
    expect(isBlockedCountry("DE", ["US", "CN"])).toBe(false)
  })

  it("returns false when countryCode is undefined", () => {
    expect(isBlockedCountry(undefined, ["US"])).toBe(false)
  })
})
