import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

const mockUseDeviceLocation = jest.fn()
const mockUseRemoteConfig = jest.fn()
const mockUseActiveWallet = jest.fn()

/** Mocked wholesale: the real module warns at load time when no API key is configured. */
jest.mock("@app/utils/ip-country-lookup", () => ({
  DEFAULT_ADAPTERS: [],
  resolveIpCountryCode: jest.fn(async () => undefined),
  resolveIpCountryCodeCached: jest.fn(async () => undefined),
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => mockUseDeviceLocation(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

import { useTransferBlock, useTransferBlocked } from "@app/hooks/use-transfer-blocked"

const setup = (): void => {
  jest.clearAllMocks()
  mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, source: undefined })
  mockUseRemoteConfig.mockReturnValue({
    custodialTransferBlockedCountries: ["DE"],
    selfCustodialTransferBlockedCountries: ["FR"],
  })
  mockUseActiveWallet.mockReturnValue({ accountType: AccountType.SelfCustodial })
}

const read = () => renderHook(() => useTransferBlocked()).result.current

describe("useTransferBlocked", () => {
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

  describe("while the region is still resolving", () => {
    const readBlock = () => renderHook(() => useTransferBlock()).result.current

    it("reports the region as pending without claiming a block", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: undefined, loading: true })

      expect(readBlock()).toEqual({ isBlocked: false, isRegionPending: true })
    })

    it("blocks once the region resolves to a blocked country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "FR", loading: false })

      expect(readBlock()).toEqual({ isBlocked: true, isRegionPending: false })
    })

    it("settles unblocked once the region resolves to an allowed country", () => {
      mockUseDeviceLocation.mockReturnValue({ countryCode: "AR", loading: false })

      expect(readBlock()).toEqual({ isBlocked: false, isRegionPending: false })
    })
  })
})
