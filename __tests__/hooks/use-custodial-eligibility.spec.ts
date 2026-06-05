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
  detectionFailed = false,
  accounts = [] as unknown[],
  custodialSignupBlockedCountries = ["US"],
  custodialFirstSignupBlockedCountries = ["GB", "DE"],
}: {
  countryCode: string | undefined
  loading?: boolean
  detectionFailed?: boolean
  accounts?: unknown[]
  custodialSignupBlockedCountries?: string[]
  custodialFirstSignupBlockedCountries?: string[]
}) => {
  mockUseDeviceLocation.mockReturnValue({ countryCode, loading, detectionFailed })
  mockUseAccountRegistry.mockReturnValue({ accounts })
  mockUseRemoteConfig.mockReturnValue({
    custodialSignupBlockedCountries,
    custodialFirstSignupBlockedCountries,
  })
}

describe("useCustodialEligibility (wiring)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uppercases the country code before applying the policy", () => {
    setUp({ countryCode: "us", accounts: [] })
    const { result } = renderHook(() => useCustodialEligibility())
    expect(result.current.signupAllowed).toBe(false)
  })

  it("passes accountCount derived from the registry to the decider", () => {
    setUp({
      countryCode: "GB",
      accounts: [{ id: "existing" }],
      custodialFirstSignupBlockedCountries: ["GB"],
    })
    const { result } = renderHook(() => useCustodialEligibility())
    expect(result.current.signupAllowed).toBe(true)
  })

  it("returns signupAllowed=true for an unblocked country", () => {
    setUp({ countryCode: "SV", accounts: [] })
    const { result } = renderHook(() => useCustodialEligibility())
    expect(result.current.signupAllowed).toBe(true)
  })

  it("forwards loading=true while country detection is in flight", () => {
    setUp({ countryCode: undefined, loading: true })
    const { result } = renderHook(() => useCustodialEligibility())
    expect(result.current.loading).toBe(true)
    expect(result.current.signupAllowed).toBe(false)
  })

  it("forwards loading=false once country resolves", () => {
    setUp({ countryCode: "SV", loading: false })
    const { result } = renderHook(() => useCustodialEligibility())
    expect(result.current.loading).toBe(false)
  })

  it("blocks signup when device-location reports a detection-failure fallback (C1)", () => {
    setUp({ countryCode: "SV", detectionFailed: true, accounts: [] })
    const { result } = renderHook(() => useCustodialEligibility())
    expect(result.current.signupAllowed).toBe(false)
  })
})
