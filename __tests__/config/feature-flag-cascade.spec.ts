/**
 * Tests the feature flag cascade invariant:
 * stableBalanceEnabled can only be true when nonCustodialEnabled is also true.
 *
 * This used to re-implement the derivation here, with a comment saying it mirrored
 * `feature-flags-context.tsx` — which stopped being true the moment that derivation
 * grew developer overrides. It now imports the real one, which lives outside the
 * context precisely so a unit test need not stand up Firebase Remote Config.
 */

import {
  deriveSelfCustodialFlags,
  FlagOverride,
  NO_FLAG_OVERRIDES,
  type SelfCustodialFlags,
} from "@app/config/feature-flag-overrides"

type RemoteFlags = SelfCustodialFlags

const deriveFlags = (remote: RemoteFlags) =>
  deriveSelfCustodialFlags(remote, NO_FLAG_OVERRIDES)

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

  describe("with a developer override", () => {
    const remoteOff: RemoteFlags = {
      nonCustodialEnabled: false,
      stableBalanceEnabled: false,
    }
    const remoteOn: RemoteFlags = {
      nonCustodialEnabled: true,
      stableBalanceEnabled: true,
    }

    it("turns self-custodial on when the fetch left it off", () => {
      // The emulator case: Remote Config needs Play Services, so a failed fetch leaves
      // every flag at its shipped false and the self-custodial path simply absent.
      const flags = deriveSelfCustodialFlags(remoteOff, {
        ...NO_FLAG_OVERRIDES,
        nonCustodialEnabled: FlagOverride.On,
      })

      expect(flags.nonCustodialEnabled).toBe(true)
    })

    it("does not turn Stable Balance on as a side effect", () => {
      // Forcing the parent flag must not grant the child one Remote Config withheld.
      const flags = deriveSelfCustodialFlags(remoteOff, {
        ...NO_FLAG_OVERRIDES,
        nonCustodialEnabled: FlagOverride.On,
      })

      expect(flags.stableBalanceEnabled).toBe(false)
    })

    it("takes Stable Balance down with a forced-off self-custodial", () => {
      // The rollback scenario in docs/self-custodial-rollout.md, and the reason the
      // override is applied before the cascade rather than after it.
      const flags = deriveSelfCustodialFlags(remoteOn, {
        ...NO_FLAG_OVERRIDES,
        nonCustodialEnabled: FlagOverride.Off,
      })

      expect(flags.nonCustodialEnabled).toBe(false)
      expect(flags.stableBalanceEnabled).toBe(false)
    })

    it("can force Stable Balance on while self-custodial is genuinely on", () => {
      const flags = deriveSelfCustodialFlags(
        { nonCustodialEnabled: true, stableBalanceEnabled: false },
        { ...NO_FLAG_OVERRIDES, stableBalanceEnabled: FlagOverride.On },
      )

      expect(flags.stableBalanceEnabled).toBe(true)
    })

    it("leaves both to Remote Config when nothing is overridden", () => {
      expect(deriveSelfCustodialFlags(remoteOn, NO_FLAG_OVERRIDES)).toEqual(remoteOn)
    })
  })
})
