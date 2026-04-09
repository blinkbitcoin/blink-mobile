/**
 * Tests the feature flag cascade invariant:
 * stableBalanceEnabled can only be true when nonCustodialEnabled is also true.
 *
 * This mirrors the derivation logic in feature-flags-context.tsx:
 *   stableBalanceEnabled: nonCustodialEnabled && stableBalanceEnabled
 */

type RemoteFlags = {
  nonCustodialEnabled: boolean
  stableBalanceEnabled: boolean
}

const deriveFlags = (remote: RemoteFlags) => ({
  nonCustodialEnabled: remote.nonCustodialEnabled,
  stableBalanceEnabled: remote.nonCustodialEnabled && remote.stableBalanceEnabled,
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
})
