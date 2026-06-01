import { renderHook } from "@testing-library/react-native"

import { useCustodialEligibility } from "@app/hooks/use-custodial-eligibility"

const mockUseRemoteConfig = jest.fn()
const mockUseDeviceLocation = jest.fn()
const mockUseAccountRegistry = jest.fn()

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockUseDeviceLocation(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const setUp = ({
  countryCode,
  loading = false,
  accounts = [] as unknown[],
  custodialSignupBlockedCountries = ["US"],
  custodialFirstSignupBlockedCountries = ["GB", "DE"],
}: {
  countryCode: string | undefined
  loading?: boolean
  accounts?: unknown[]
  custodialSignupBlockedCountries?: string[]
  custodialFirstSignupBlockedCountries?: string[]
}) => {
  mockUseDeviceLocation.mockReturnValue({ countryCode, loading })
  mockUseAccountRegistry.mockReturnValue({ accounts })
  mockUseRemoteConfig.mockReturnValue({
    custodialSignupBlockedCountries,
    custodialFirstSignupBlockedCountries,
  })
}

describe("useCustodialEligibility", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("country in always-blocked list (US)", () => {
    it("blocks signup as first account", () => {
      setUp({ countryCode: "US", accounts: [] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(true)
      expect(result.current.firstSignupBlocked).toBe(false)
      expect(result.current.isFirstSignup).toBe(true)
      expect(result.current.signupAllowed).toBe(false)
    })

    it("blocks signup as second+ account too", () => {
      setUp({ countryCode: "US", accounts: [{ id: "a" }] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(true)
      expect(result.current.isFirstSignup).toBe(false)
      expect(result.current.signupAllowed).toBe(false)
    })
  })

  describe("country in first-signup-blocked list (GB)", () => {
    it("blocks signup when there are no accounts yet", () => {
      setUp({ countryCode: "GB", accounts: [] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(false)
      expect(result.current.firstSignupBlocked).toBe(true)
      expect(result.current.isFirstSignup).toBe(true)
      expect(result.current.signupAllowed).toBe(false)
    })

    it("allows signup when at least one account already exists", () => {
      setUp({ countryCode: "GB", accounts: [{ id: "existing" }] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(false)
      expect(result.current.firstSignupBlocked).toBe(true)
      expect(result.current.isFirstSignup).toBe(false)
      expect(result.current.signupAllowed).toBe(true)
    })
  })

  describe("country not in any list (SV)", () => {
    it("allows signup as first account", () => {
      setUp({ countryCode: "SV", accounts: [] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(false)
      expect(result.current.firstSignupBlocked).toBe(false)
      expect(result.current.signupAllowed).toBe(true)
    })

    it("allows signup as second+ account", () => {
      setUp({ countryCode: "SV", accounts: [{ id: "a" }, { id: "b" }] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupAllowed).toBe(true)
    })
  })

  describe("country code normalization", () => {
    it("matches lowercase country codes against the always-blocked list", () => {
      setUp({ countryCode: "us", accounts: [] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(true)
      expect(result.current.signupAllowed).toBe(false)
    })

    it("matches mixed-case country codes against the first-signup list", () => {
      setUp({ countryCode: "Gb", accounts: [] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.firstSignupBlocked).toBe(true)
      expect(result.current.signupAllowed).toBe(false)
    })
  })

  describe("country undefined", () => {
    it("treats both blocks as false when country is still being detected", () => {
      setUp({ countryCode: undefined, loading: true, accounts: [] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(false)
      expect(result.current.firstSignupBlocked).toBe(false)
      expect(result.current.signupAllowed).toBe(true)
    })
  })

  describe("loading propagation", () => {
    it("forwards loading=true from useDeviceLocation", () => {
      setUp({ countryCode: undefined, loading: true })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.loading).toBe(true)
    })

    it("forwards loading=false once country resolves", () => {
      setUp({ countryCode: "SV", loading: false })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.loading).toBe(false)
    })
  })

  describe("isFirstSignup boundary", () => {
    it("is true when accounts is empty", () => {
      setUp({ countryCode: "SV", accounts: [] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.isFirstSignup).toBe(true)
    })

    it("is false with any number of existing accounts", () => {
      setUp({ countryCode: "SV", accounts: [{}, {}, {}] })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.isFirstSignup).toBe(false)
    })
  })

  describe("empty remote config lists", () => {
    it("allows signup everywhere when both lists are empty", () => {
      setUp({
        countryCode: "US",
        accounts: [],
        custodialSignupBlockedCountries: [],
        custodialFirstSignupBlockedCountries: [],
      })
      const { result } = renderHook(() => useCustodialEligibility())

      expect(result.current.signupBlocked).toBe(false)
      expect(result.current.firstSignupBlocked).toBe(false)
      expect(result.current.signupAllowed).toBe(true)
    })
  })
})
