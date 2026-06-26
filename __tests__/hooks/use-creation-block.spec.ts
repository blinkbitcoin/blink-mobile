import { renderHook } from "@testing-library/react-native"

import { AccountOption } from "@app/hooks/use-account-type-options"
import { useCreationBlock } from "@app/hooks/use-creation-block"

const mockUseRemoteConfig = jest.fn()
const mockUseDeviceLocation = jest.fn()

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => mockUseRemoteConfig(),
}))

jest.mock("@app/hooks/use-account-type-options", () => ({
  AccountOption: { Custodial: "custodial", SelfCustodial: "selfCustodial" },
}))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  ...jest.requireActual("@app/hooks/use-device-location"),
  default: () => mockUseDeviceLocation(),
}))

const setUp = ({
  countryCode,
  loading = false,
  custodialCreationBlockedCountries = ["CU", "IR"],
  selfCustodialCreationBlockedCountries = ["KP", "SY"],
}: {
  countryCode: string | undefined
  loading?: boolean
  custodialCreationBlockedCountries?: string[]
  selfCustodialCreationBlockedCountries?: string[]
}) => {
  mockUseDeviceLocation.mockReturnValue({ countryCode, loading })
  mockUseRemoteConfig.mockReturnValue({
    custodialCreationBlockedCountries,
    selfCustodialCreationBlockedCountries,
  })
  return renderHook(() => useCreationBlock()).result.current
}

describe("useCreationBlock", () => {
  beforeEach(() => jest.clearAllMocks())

  it("blocks the custodial option when the country is in the custodial list", () => {
    const { isCreationBlocked } = setUp({ countryCode: "CU" })
    expect(isCreationBlocked(AccountOption.Custodial)).toBe(true)
  })

  it("blocks the self-custodial option when the country is in the self-custodial list", () => {
    const { isCreationBlocked } = setUp({ countryCode: "KP" })
    expect(isCreationBlocked(AccountOption.SelfCustodial)).toBe(true)
  })

  it("reads each option from its own list, so the lists can diverge", () => {
    const { isCreationBlocked } = setUp({
      countryCode: "CU",
      custodialCreationBlockedCountries: ["CU"],
      selfCustodialCreationBlockedCountries: ["KP"],
    })
    expect(isCreationBlocked(AccountOption.Custodial)).toBe(true)
    expect(isCreationBlocked(AccountOption.SelfCustodial)).toBe(false)
  })

  it("allows an option whose list does not contain the country", () => {
    const { isCreationBlocked } = setUp({ countryCode: "SV" })
    expect(isCreationBlocked(AccountOption.Custodial)).toBe(false)
    expect(isCreationBlocked(AccountOption.SelfCustodial)).toBe(false)
  })

  it("matches case-insensitively", () => {
    const { isCreationBlocked } = setUp({
      countryCode: "cu",
      custodialCreationBlockedCountries: ["CU"],
    })
    expect(isCreationBlocked(AccountOption.Custodial)).toBe(true)
  })

  it("does not block when the country is undefined", () => {
    const { isCreationBlocked } = setUp({ countryCode: undefined })
    expect(isCreationBlocked(AccountOption.Custodial)).toBe(false)
    expect(isCreationBlocked(AccountOption.SelfCustodial)).toBe(false)
  })

  it("passes through the location loading flag", () => {
    expect(setUp({ countryCode: undefined, loading: true }).loading).toBe(true)
    expect(setUp({ countryCode: "SV", loading: false }).loading).toBe(false)
  })
})
