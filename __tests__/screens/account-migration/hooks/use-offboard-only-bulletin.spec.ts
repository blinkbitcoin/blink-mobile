import { renderHook } from "@testing-library/react-native"

import { useOffboardOnlyBulletin } from "@app/screens/account-migration/hooks/use-offboard-only-bulletin"
import { AccountType } from "@app/types/wallet"

let mockAccountType: AccountType = AccountType.Custodial

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: mockAccountType } }),
}))

let mockPhoneCountry: string | undefined = "AE"

jest.mock("@app/hooks/use-device-location", () => ({
  ...jest.requireActual("@app/hooks/use-device-location"),
  usePhoneCountryCode: () => mockPhoneCountry,
}))

let mockOffboardOnlyCountries: string[] = ["AE", "NP", "DZ"]

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ offboardOnlyCountries: mockOffboardOnlyCountries }),
}))

const mockBalances = {
  btcBalanceSats: 21_000,
  usdBalanceCents: 500,
  isReady: true,
  isSkipped: false,
}
const mockUseCustodialWalletBalances = jest.fn()

jest.mock("@app/screens/account-migration/hooks/use-custodial-wallet-balances", () => ({
  useCustodialWalletBalances: (options: { skip?: boolean }) => {
    mockUseCustodialWalletBalances(options)
    return { ...mockBalances, isSkipped: mockBalances.isSkipped || Boolean(options.skip) }
  },
}))

describe("useOffboardOnlyBulletin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountType = AccountType.Custodial
    mockPhoneCountry = "AE"
    mockOffboardOnlyCountries = ["AE", "NP", "DZ"]
    mockBalances.btcBalanceSats = 21_000
    mockBalances.usdBalanceCents = 500
    mockBalances.isReady = true
    mockBalances.isSkipped = false
  })

  it("shows for a funded custodial account registered in an offboard-only country", () => {
    const { result } = renderHook(() => useOffboardOnlyBulletin())

    expect(result.current.isVisible).toBe(true)
  })

  it("never shows for a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial

    const { result } = renderHook(() => useOffboardOnlyBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("hides for a registered country outside the offboard list", () => {
    mockPhoneCountry = "SV"

    const { result } = renderHook(() => useOffboardOnlyBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("hides everywhere once ops empties the remote list after the deadline", () => {
    mockOffboardOnlyCountries = []

    const { result } = renderHook(() => useOffboardOnlyBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("hides once the funds are withdrawn: both balances settled at zero", () => {
    mockBalances.btcBalanceSats = 0
    mockBalances.usdBalanceCents = 0

    const { result } = renderHook(() => useOffboardOnlyBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("keeps showing while balances are unknown, never reading loading zeros as drained", () => {
    mockBalances.btcBalanceSats = 0
    mockBalances.usdBalanceCents = 0
    mockBalances.isReady = false

    const { result } = renderHook(() => useOffboardOnlyBulletin())

    expect(result.current.isVisible).toBe(true)
  })

  it("hides when the phone country cannot be parsed", () => {
    mockPhoneCountry = undefined

    const { result } = renderHook(() => useOffboardOnlyBulletin())

    expect(result.current.isVisible).toBe(false)
  })

  it("skips the balance query when the country gate already hides the card", () => {
    mockPhoneCountry = "SV"

    renderHook(() => useOffboardOnlyBulletin())

    expect(mockUseCustodialWalletBalances).toHaveBeenCalledWith({ skip: true })
  })

  it("skips the balance query for a self-custodial account", () => {
    mockAccountType = AccountType.SelfCustodial

    renderHook(() => useOffboardOnlyBulletin())

    expect(mockUseCustodialWalletBalances).toHaveBeenCalledWith({ skip: true })
  })

  it("runs the balance query only when the card can actually show", () => {
    renderHook(() => useOffboardOnlyBulletin())

    expect(mockUseCustodialWalletBalances).toHaveBeenCalledWith({ skip: false })
  })
})
