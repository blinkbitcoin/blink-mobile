/**
 * Tests the feature flag cascade invariant:
 * stableBalanceEnabled can only be true when the console turns nonCustodialEnabled on.
 *
 * This mirrors the derivation logic in feature-flags-context.tsx:
 *   stableBalanceEnabled:
 *     isNonCustodialFlagSettled && nonCustodialEnabled && stableBalanceEnabled
 */

type RemoteFlags = {
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
  isNonCustodialFlagSettled?: boolean
}

const deriveFlags = ({ isNonCustodialFlagSettled = true, ...remote }: RemoteFlags) => ({
  nonCustodialEnabled: remote.nonCustodialEnabled,
  stableBalanceEnabled:
    isNonCustodialFlagSettled &&
    remote.nonCustodialEnabled &&
    remote.stableBalanceEnabled,
})

describe("feature flag cascade", () => {
  it("stableBalanceEnabled is true when both flags are true", () => {
    const flags = deriveFlags({ nonCustodialEnabled: true, stableBalanceEnabled: true })

    expect(flags.stableBalanceEnabled).toBe(true)
    expect(flags.nonCustodialEnabled).toBe(true)
  })

  it("stableBalanceEnabled is false when nonCustodialEnabled is false", () => {
    const flags = deriveFlags({ nonCustodialEnabled: false, stableBalanceEnabled: true })

    expect(flags.stableBalanceEnabled).toBe(false)
  })

  it("stableBalanceEnabled is false when stableBalanceEnabled remote is false", () => {
    const flags = deriveFlags({ nonCustodialEnabled: true, stableBalanceEnabled: false })

    expect(flags.stableBalanceEnabled).toBe(false)
  })

  it("both false when both remote flags are false", () => {
    const flags = deriveFlags({ nonCustodialEnabled: false, stableBalanceEnabled: false })

    expect(flags.stableBalanceEnabled).toBe(false)
    expect(flags.nonCustodialEnabled).toBe(false)
  })

  it("stableBalanceEnabled is false while only the shipped default turns nonCustodialEnabled on", () => {
    const flags = deriveFlags({
      nonCustodialEnabled: true,
      stableBalanceEnabled: true,
      isNonCustodialFlagSettled: false,
    })

    expect(flags.stableBalanceEnabled).toBe(false)
    expect(flags.nonCustodialEnabled).toBe(true)
  })
})
