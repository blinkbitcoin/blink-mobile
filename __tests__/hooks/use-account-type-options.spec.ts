import { renderHook } from "@testing-library/react-native"

import { AccountOption, useAccountTypeOptions } from "@app/hooks/use-account-type-options"

const mockUseFeatureFlags = jest.fn()

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}))

const setUp = (nonCustodialEnabled: boolean) => {
  mockUseFeatureFlags.mockReturnValue({ nonCustodialEnabled })
  return renderHook(() => useAccountTypeOptions()).result.current
}

describe("useAccountTypeOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("offers both options when self-custodial is enabled", () => {
    const { options } = setUp(true)

    expect(options).toEqual([AccountOption.SelfCustodial, AccountOption.Custodial])
  })

  it("offers custodial alone when self-custodial is turned off", () => {
    const { options } = setUp(false)

    expect(options).toEqual([AccountOption.Custodial])
  })

  it("preselects the only option when just one is offered", () => {
    expect(setUp(false).defaultSelected).toBe(AccountOption.Custodial)
  })

  it("preselects nothing when both are offered", () => {
    expect(setUp(true).defaultSelected).toBeNull()
  })

  it("reports self-custodial as temporarily disabled when the flag is off", () => {
    expect(setUp(false).selfCustodialTemporarilyDisabled).toBe(true)
    expect(setUp(true).selfCustodialTemporarilyDisabled).toBe(false)
  })

  it("offers custodial without consulting the user's location", () => {
    // Region rules belong to useCreationBlock, so merely opening the screen locates nobody.
    const { options } = setUp(true)

    expect(options).toContain(AccountOption.Custodial)
    expect(mockUseFeatureFlags).toHaveBeenCalled()
  })
})
