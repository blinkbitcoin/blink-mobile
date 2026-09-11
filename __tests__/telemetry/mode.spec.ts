// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import analytics from "@react-native-firebase/analytics"

import { TelemetryEvent } from "@app/telemetry/contract"
import { resetDiagnosticsForTesting } from "@app/telemetry/diagnostics"
import {
  ActiveAccountKind,
  deriveTelemetryMode,
  getTelemetryMode,
  initializeTelemetryGate,
  isDrainPermitted,
  isEventPermitted,
  onTelemetrySuppressed,
  resetTelemetryModeForTesting,
  resolveTelemetryMode,
  TelemetryMode,
} from "@app/telemetry/mode"

const setCollectionEnabled = analytics().setAnalyticsCollectionEnabled as jest.Mock
const setUserId = analytics().setUserId as jest.Mock

const inputs = (overrides: Partial<Parameters<typeof deriveTelemetryMode>[0]> = {}) => ({
  activeAccount: ActiveAccountKind.SelfCustodial,
  selfCustodialMode: null,
  remoteConfigTrusted: true,
  hasSelfCustodialAccount: true,
  ...overrides,
})

describe("deriveTelemetryMode", () => {
  it.each([
    {
      case: "an Enhanced self-custodial account",
      given: inputs({ selfCustodialMode: "enhanced" as const }),
      expected: TelemetryMode.Enhanced,
    },
    {
      case: "an incognito self-custodial account",
      given: inputs({ selfCustodialMode: "anon" as const }),
      expected: TelemetryMode.Anon,
    },
    {
      case: "a self-custodial account that never chose a mode",
      given: inputs({ selfCustodialMode: null }),
      expected: TelemetryMode.Unresolved,
    },
    {
      case: "a custodial account on a trusted config",
      given: inputs({ activeAccount: ActiveAccountKind.Custodial }),
      expected: TelemetryMode.Custodial,
    },
    {
      case: "no account at all",
      given: inputs({ activeAccount: ActiveAccountKind.None }),
      expected: TelemetryMode.Unresolved,
    },
  ])("resolves $case as $expected", ({ given, expected }) => {
    expect(deriveTelemetryMode(given)).toBe(expected)
  })

  describe("FR-6 — failure never falls back to enabled", () => {
    it("refuses to read an unset mode as Enhanced", () => {
      // The settings row does exactly this so it has something to display. §5.7 asks for a
      // positive resolution, and "we never asked, so we assumed consent" is not one.
      expect(deriveTelemetryMode(inputs({ selfCustodialMode: null }))).not.toBe(
        TelemetryMode.Enhanced,
      )
    })

    it("does not resolve Custodial off an untrusted remote config (AD-9)", () => {
      // `nonCustodialEnabled` defaults to false and `remoteConfigReady` is set in a
      // `finally`, so a failed fetch used to bounce a self-custodial user to custodial —
      // and full platform collection on with them.
      expect(
        deriveTelemetryMode(
          inputs({
            activeAccount: ActiveAccountKind.Custodial,
            remoteConfigTrusted: false,
            hasSelfCustodialAccount: true,
          }),
        ),
      ).toBe(TelemetryMode.Unresolved)
    })

    it("keeps custodial analytics for a device that has no self-custodial account", () => {
      // Nothing to have been rolled back from, so the untrusted config changes nothing —
      // the PRD leaves custodial behaviour alone beyond relabelling.
      expect(
        deriveTelemetryMode(
          inputs({
            activeAccount: ActiveAccountKind.Custodial,
            remoteConfigTrusted: false,
            hasSelfCustodialAccount: false,
          }),
        ),
      ).toBe(TelemetryMode.Custodial)
    })
  })
})

describe("the collection gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetTelemetryModeForTesting()
    resetDiagnosticsForTesting()
  })

  it("starts closed, and stays closed until a mode is resolved", async () => {
    await initializeTelemetryGate()

    expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
    expect(setCollectionEnabled).toHaveBeenCalledWith(false)
    expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
  })

  describe("FR-70 — the gate is mode × contract membership", () => {
    const contractEvent = TelemetryEvent.PaymentSettled
    const platformEvent = "screen_view"

    it.each([
      { mode: TelemetryMode.Custodial, contract: true, platform: true },
      { mode: TelemetryMode.Enhanced, contract: true, platform: false },
      { mode: TelemetryMode.Anon, contract: false, platform: false },
      { mode: TelemetryMode.Unresolved, contract: false, platform: false },
    ])(
      "$mode permits contract events: $contract, non-contract events: $platform",
      async ({ mode, contract, platform }) => {
        await resolveTelemetryMode(mode)

        expect({
          contract: isEventPermitted(contractEvent),
          platform: isEventPermitted(platformEvent),
        }).toEqual({ contract, platform })
      },
    )

    it("runs platform collection on Custodial alone", async () => {
      // CD-6 (2026-09-11) would have Enhanced collection on so contract events could ride
      // Firebase. That needs the SDK to suppress its automatic events while logEvent()
      // stays live, and @react-native-firebase/analytics@23.3.1 offers no such switch
      // (spine Q13, verified — see platform-analytics.ts). Enhanced therefore stays off,
      // and this assertion is the FR-70 side of that answer.
      await resolveTelemetryMode(TelemetryMode.Custodial)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(true)

      await resolveTelemetryMode(TelemetryMode.Enhanced)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)

      await resolveTelemetryMode(TelemetryMode.Anon)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)

      await resolveTelemetryMode(TelemetryMode.Unresolved)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)
    })
  })

  describe("AD-16 — no user-scoped identity survives into a self-custodial session", () => {
    it("clears the analytics user id when a self-custodial account activates", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)
      setUserId.mockClear()

      await resolveTelemetryMode(TelemetryMode.Enhanced)

      expect(setUserId).toHaveBeenCalledWith(null)
    })

    it("leaves it alone while the session stays custodial", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)

      expect(setUserId).not.toHaveBeenCalled()
    })
  })

  describe("FR-4 / FR-5 — discard, never flush then discard", () => {
    it("discards before it disables collection", async () => {
      const order: string[] = []
      onTelemetrySuppressed(() => {
        order.push("discard")
      })
      setCollectionEnabled.mockImplementation(() => {
        order.push("disable")
        return Promise.resolve()
      })

      await resolveTelemetryMode(TelemetryMode.Enhanced)
      order.length = 0

      await resolveTelemetryMode(TelemetryMode.Anon)

      expect(order).toEqual(["discard", "disable"])
    })

    it("waits for an async discard before disabling", async () => {
      const order: string[] = []
      onTelemetrySuppressed(async () => {
        await Promise.resolve()
        order.push("discard")
      })
      setCollectionEnabled.mockImplementation(() => {
        order.push("disable")
        return Promise.resolve()
      })

      await resolveTelemetryMode(TelemetryMode.Enhanced)
      order.length = 0

      await resolveTelemetryMode(TelemetryMode.Anon)

      expect(order).toEqual(["discard", "disable"])
    })

    it("does not notify listeners on the way into a collecting mode", async () => {
      const discard = jest.fn()
      onTelemetrySuppressed(discard)

      await resolveTelemetryMode(TelemetryMode.Enhanced)
      expect(discard).not.toHaveBeenCalled()

      // Anchor: the same listener does fire when the gate actually closes, so the silence
      // above is the transition's doing and not a dead registration.
      await resolveTelemetryMode(TelemetryMode.Anon)
      expect(discard).toHaveBeenCalledTimes(1)
    })

    it("stops capture the instant the mode changes, not when the discard finishes", () => {
      resolveTelemetryMode(TelemetryMode.Enhanced)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(true)

      // No await: the directory unlink is still in flight.
      resolveTelemetryMode(TelemetryMode.Anon)

      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(false)
    })

    it("survives a listener that throws", async () => {
      onTelemetrySuppressed(() => {
        throw new Error("unlink failed")
      })

      await resolveTelemetryMode(TelemetryMode.Enhanced)
      await expect(resolveTelemetryMode(TelemetryMode.Anon)).resolves.toBeUndefined()
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)
    })
  })

  describe("AD-5 — the gate covers the drain, not just capture", () => {
    it.each([
      { mode: TelemetryMode.Enhanced, permitted: true },
      { mode: TelemetryMode.Custodial, permitted: false },
      { mode: TelemetryMode.Anon, permitted: false },
      { mode: TelemetryMode.Unresolved, permitted: false },
    ])("permits draining under $mode: $permitted", async ({ mode, permitted }) => {
      await resolveTelemetryMode(mode)
      expect(isDrainPermitted()).toBe(permitted)
    })
  })
})
