import { renderHook } from "@testing-library/react-native"

import { useTwoFactorTurnOff } from "@app/custodial/hooks/use-two-factor-turn-off"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"

const mockEnforcement = {
  tier: TwoFactorTier.Recommended as TwoFactorTier,
  isEnforced: true,
  isPreparingSessionStart: false,
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

const mockLogAttempted = jest.fn()
const mockLogBlocked = jest.fn()
jest.mock("@app/utils/analytics", () => ({
  logTwoFactorDisableAttempted: (...args: unknown[]) => mockLogAttempted(...args),
  logTwoFactorDisableBlocked: (...args: unknown[]) => mockLogBlocked(...args),
}))

describe("useTwoFactorTurnOff", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEnforcement.tier = TwoFactorTier.Recommended
    mockEnforcement.isEnforced = true
    mockEnforcement.isPreparingSessionStart = false
  })

  const tiersBelowEnforced = [
    TwoFactorTier.None,
    TwoFactorTier.Suggested,
    TwoFactorTier.Recommended,
  ]
  for (const tier of tiersBelowEnforced) {
    it(`lets the authenticator be turned off at tier ${tier}`, () => {
      mockEnforcement.tier = tier
      const { result } = renderHook(() => useTwoFactorTurnOff())

      expect(result.current.isTurnOffBlocked).toBe(false)
    })
  }

  /** The tier reached never lowers, so a balance that dropped since still blocks. */
  it("refuses turning it off once the enforced tier is reached", () => {
    mockEnforcement.tier = TwoFactorTier.Enforced
    const { result } = renderHook(() => useTwoFactorTurnOff())

    expect(result.current.isTurnOffBlocked).toBe(true)
  })

  /** With the prompts off nothing of the tiers shows; the server still refuses a
   *  balance that high. */
  it("refuses nothing while the prompts do not apply", () => {
    mockEnforcement.tier = TwoFactorTier.Enforced
    mockEnforcement.isEnforced = false
    const { result } = renderHook(() => useTwoFactorTurnOff())

    expect(result.current.isTurnOffBlocked).toBe(false)
  })

  /** Until the record is read, a tier-three account would read as allowed. */
  it("is undecided while the tier reached is still being read", () => {
    mockEnforcement.isPreparingSessionStart = true
    const { result } = renderHook(() => useTwoFactorTurnOff())

    expect(result.current.isTurnOffDecided).toBe(false)
  })

  it("is decided once the tier reached is known", () => {
    const { result } = renderHook(() => useTwoFactorTurnOff())

    expect(result.current.isTurnOffDecided).toBe(true)
  })

  it("reports the attempt and the refusal under the tier reached", () => {
    mockEnforcement.tier = TwoFactorTier.Enforced
    const { result } = renderHook(() => useTwoFactorTurnOff())

    result.current.reportAttempt()
    result.current.reportBlocked()

    expect(mockLogAttempted).toHaveBeenCalledWith({ tier: TwoFactorTier.Enforced })
    expect(mockLogBlocked).toHaveBeenCalledWith({ tier: TwoFactorTier.Enforced })
  })
})
