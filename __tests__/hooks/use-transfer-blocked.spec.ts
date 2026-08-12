import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
let mockRemoteConfigReady = true
const mockUseActiveWallet = jest.fn()

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

import { useTransferGate, useTransferGated } from "@app/hooks/use-transfer-blocked"

const setup = (): void => {
  jest.clearAllMocks()
  mockRemoteConfigReady = true
  mockIsAnonMode = false
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue({
    custodialDollarBalanceBlockedCountries: [],
    custodialTransferBlockedCountries: ["DE"],
    selfCustodialDollarBalanceBlockedCountries: [],
    selfCustodialTransferBlockedCountries: ["FR"],
  })
  mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
}

/** Outside Anon (the setup default), the gate reduces to the region policy. */
const read = () => renderHook(() => useTransferGated()).result.current

describe("useTransferGated — region policy", () => {
  beforeEach(setup)

  it("blocks a self-custodial transfer when the country is in the self-custodial list", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })
    expect(read()).toBe(true)
  })

  it("blocks a custodial transfer when the country is in the custodial list", () => {
    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    mockUseDeviceLocation.mockReturnValue({ countryCode: "DE" })
    expect(read()).toBe(true)
  })

  it("reads each account type from its own list, so the lists can diverge", () => {
    mockUseDeviceLocation.mockReturnValue({ countryCode: "FR" })

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
    expect(read()).toBe(true)

    mockUseActiveWallet.mockReturnValue({ accountType: AccountType.Custodial })
    expect(read()).toBe(false)
  })

  it("returns false when the country is in neither list", () => {
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
