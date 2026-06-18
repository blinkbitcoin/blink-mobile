import { renderHook } from "@testing-library/react-native"

import { AccountOption, useAccountTypeOptions } from "@app/hooks/use-account-type-options"
import { AccountTypeMode } from "@app/types/account"

const mockUseFeatureFlags = jest.fn()
const mockUseCustodialEligibility = jest.fn()

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}))

jest.mock("@app/hooks/use-custodial-eligibility", () => ({
  useCustodialEligibility: () => mockUseCustodialEligibility(),
}))

const setUp = ({
  nonCustodialEnabled = true,
  signupAllowed = true,
  loading = false,
}: {
  nonCustodialEnabled?: boolean
  signupAllowed?: boolean
  loading?: boolean
}) => {
  mockUseFeatureFlags.mockReturnValue({ nonCustodialEnabled })
  mockUseCustodialEligibility.mockReturnValue({ signupAllowed, loading })
}

describe("useAccountTypeOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("create flow", () => {
    it("returns both options when SC is enabled and custodial signup is allowed", () => {
      setUp({ nonCustodialEnabled: true, signupAllowed: true })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Create))

      expect(result.current.options).toEqual([
        AccountOption.SelfCustodial,
        AccountOption.Custodial,
      ])
      expect(result.current.defaultSelected).toBeNull()
      expect(result.current.selfCustodialTemporarilyDisabled).toBe(false)
    })

    it("returns only self-custodial when custodial signup is blocked", () => {
      setUp({ nonCustodialEnabled: true, signupAllowed: false })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Create))

      expect(result.current.options).toEqual([AccountOption.SelfCustodial])
      expect(result.current.defaultSelected).toBe(AccountOption.SelfCustodial)
    })

    it("returns only custodial when SC is disabled and signup is allowed", () => {
      setUp({ nonCustodialEnabled: false, signupAllowed: true })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Create))

      expect(result.current.options).toEqual([AccountOption.Custodial])
      expect(result.current.defaultSelected).toBe(AccountOption.Custodial)
      expect(result.current.selfCustodialTemporarilyDisabled).toBe(true)
    })

    it("returns no options when both SC is disabled and custodial signup is blocked", () => {
      setUp({ nonCustodialEnabled: false, signupAllowed: false })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Create))

      expect(result.current.options).toEqual([])
      expect(result.current.defaultSelected).toBeNull()
      expect(result.current.selfCustodialTemporarilyDisabled).toBe(true)
    })

    it("propagates loading from useCustodialEligibility", () => {
      setUp({ nonCustodialEnabled: true, signupAllowed: false, loading: true })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Create))

      expect(result.current.loading).toBe(true)
    })
  })

  describe("restore flow", () => {
    it("shows custodial even when custodial signup would be blocked for new accounts", () => {
      setUp({ nonCustodialEnabled: true, signupAllowed: false })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Restore))

      expect(result.current.options).toEqual([
        AccountOption.SelfCustodial,
        AccountOption.Custodial,
      ])
    })

    it("reports loading=false even when device location is still loading", () => {
      setUp({ nonCustodialEnabled: true, signupAllowed: false, loading: true })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Restore))

      expect(result.current.loading).toBe(false)
      expect(result.current.options).toContain(AccountOption.Custodial)
    })

    it("keeps custodial as the only option when SC is disabled", () => {
      setUp({ nonCustodialEnabled: false, signupAllowed: false })

      const { result } = renderHook(() => useAccountTypeOptions(AccountTypeMode.Restore))

      expect(result.current.options).toEqual([AccountOption.Custodial])
      expect(result.current.defaultSelected).toBe(AccountOption.Custodial)
    })
  })

  describe("default mode", () => {
    it("defaults to Create mode when no mode argument is passed", () => {
      setUp({ nonCustodialEnabled: true, signupAllowed: false })

      const explicit = renderHook(() => useAccountTypeOptions(AccountTypeMode.Create))
      const defaulted = renderHook(() => useAccountTypeOptions())

      expect(defaulted.result.current.options).toEqual(explicit.result.current.options)
    })
  })
})
