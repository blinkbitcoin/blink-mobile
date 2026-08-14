import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
let mockRemoteConfigReady = true
const mockUseActiveWallet = jest.fn()
const mockUseCustodialRestrictionsQuery = jest.fn()
let mockIsAuthed = true

jest.mock("@app/utils/ip-country-lookup")

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => mockUseDeviceLocation(),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
  useFeatureFlags: () => ({ remoteConfigReady: mockRemoteConfigReady }),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ loading: false }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useCustodialRestrictionsQuery: (options: unknown) =>
    mockUseCustodialRestrictionsQuery(options),
}))

import { useTransferGate, useTransferGated } from "@app/hooks/use-transfer-blocked"

/** The server's answer, for the custodial cases. Self-custodial is the setup default and
 *  never reaches the query. */
const serverAnswers = (transfer: boolean, loading = false) =>
  mockUseCustodialRestrictionsQuery.mockReturnValue({
    data: { custodialRestrictions: { dollarBalance: false, transfer } },
    loading,
  })

const setup = (): void => {
  jest.clearAllMocks()
  mockRemoteConfigReady = true
  mockIsAnonMode = false
  mockIsAuthed = true
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue({
    selfCustodialDollarBalanceBlockedCountries: [],
    selfCustodialTransferBlockedCountries: ["FR"],
  })
  mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
  serverAnswers(false)
}

/** Outside Anon (the setup default), the gate reduces to the region policy. */
const read = () => renderHook(() => useTransferGated()).result.current

describe("useTransferGated — region policy", () => {
  beforeEach(setup)

  it("blocks a self-custodial transfer when the country is in the self-custodial list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
    expect(read()).toBe(true)
  })

  it("blocks a custodial transfer when the server says so", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    serverAnswers(true)
    expect(read()).toBe(true)
  })

  it("answers each account type from its own source, so the two can diverge", () => {
    // The self-custodial list carries FR; the server clears the custodial account.
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
    expect(read()).toBe(true)

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    serverAnswers(false)
    expect(read()).toBe(false)
  })

  it("returns false when the self-custodial list does not carry the country", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "AR" })
    expect(read()).toBe(false)
  })

  it("is case-insensitive on the device country", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "fr" })
    expect(read()).toBe(true)
  })

  it("returns false without a resolved country", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: undefined })
    expect(read()).toBe(false)
  })

  it("gates a custodial account the server did not answer for", () => {
    // No region determined, no gated feature — UnknownRegionPolicy = FAIL_CLOSED.
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseCustodialRestrictionsQuery.mockReturnValue({ data: undefined, loading: false })

    expect(read()).toBe(true)
  })

  describe("useTransferGated", () => {
    const readGated = () => renderHook(() => useTransferGated()).result.current

    it("gates in Anon mode with no region resolved at all", () => {
      mockIsAnonMode = true
      expect(readGated()).toBe(true)
    })

    it("gates in a blocked region outside Anon mode", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
      expect(readGated()).toBe(true)
    })

    it("does not gate when neither Anon nor the region applies", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "AR" })
      expect(readGated()).toBe(false)
    })
  })

  describe("while the region is still resolving", () => {
    const readGate = () => renderHook(() => useTransferGate()).result.current

    it("reports the region as pending without claiming a gate", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })

      expect(readGate()).toEqual({ isGated: false, isRegionPending: true })
    })

    it("gates once the region resolves to a blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", loading: false })

      expect(readGate()).toEqual({ isGated: true, isRegionPending: false })
    })

    it("settles ungated once the region resolves to an allowed country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", loading: false })

      expect(readGate()).toEqual({ isGated: false, isRegionPending: false })
    })

    /** Anon gates on the mode alone, so no region resolves and nothing pends. */
    it("never pends in Anon mode", () => {
      mockIsAnonMode = true
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: false })

      expect(readGate()).toEqual({ isGated: true, isRegionPending: false })
    })

    it("pends a custodial account while the server has not answered", () => {
      mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
      serverAnswers(false, true)

      expect(readGate()).toEqual({ isGated: false, isRegionPending: true })
    })
  })

  describe("before the block-lists have arrived", () => {
    it("reports the region pending rather than a verdict off the compiled defaults", () => {
      mockRemoteConfigReady = false

      const { isRegionPending, isGated } = renderHook(() => useTransferGate()).result
        .current

      // A list still being fetched would read as a country nothing restricts, and the
      // surface would settle on it and then flip once the real list lands.
      expect(isRegionPending).toBe(true)
      expect(isGated).toBe(false)
    })
  })
})
