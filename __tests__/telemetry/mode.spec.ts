// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import analytics from "@react-native-firebase/analytics"

import { TelemetryEvent } from "@app/telemetry/contract"
import {
  getDiagnosticCounters,
  resetDiagnosticsForTesting,
} from "@app/telemetry/diagnostics"
import {
  applyServerKillSwitch,
  isTelemetryEnabled,
  onKillSwitchEngaged,
  resetEnablementForTesting,
  restoreKillSwitch,
  setTelemetryRolloutEnabled,
} from "@app/telemetry/enablement"
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
  type TelemetryModeInputs,
} from "@app/telemetry/mode"

import {
  resetPlatformIdentityForTesting,
  setCustodialAnalyticsIdentity,
} from "@app/telemetry/platform-analytics"

const setCollectionEnabled = analytics().setAnalyticsCollectionEnabled as jest.Mock
const setUserId = analytics().setUserId as jest.Mock
const setUserProperties = analytics().setUserProperties as jest.Mock

const inputs = (overrides: Partial<TelemetryModeInputs> = {}): TelemetryModeInputs => ({
  activeAccount: ActiveAccountKind.SelfCustodial,
  persistedMode: null,
  serverMode: null,
  remoteConfigTrusted: true,
  hasSelfCustodialAccount: true,
  ...overrides,
})

describe("deriveTelemetryMode (AD-5, AD-25)", () => {
  it.each([
    {
      case: "Enhanced chosen on this device, server silent",
      given: inputs({ persistedMode: "enhanced" }),
      expected: TelemetryMode.Enhanced,
    },
    {
      case: "Enhanced held by the server, nothing persisted yet",
      given: inputs({ serverMode: "enhanced" }),
      expected: TelemetryMode.Enhanced,
    },
    {
      case: "incognito chosen on this device",
      given: inputs({ persistedMode: "anon" }),
      expected: TelemetryMode.Anon,
    },
    {
      case: "incognito held by the server",
      given: inputs({ serverMode: "anon" }),
      expected: TelemetryMode.Anon,
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
    it("resolves an account with no mode anywhere as Unresolved, never Enhanced", () => {
      // In flight, never asked, or the server holding no mode: the same answer. The
      // settings row reads an unset mode as Enhanced so it has something to display; §5.7
      // asks for a positive resolution, and "we never asked" is not one.
      expect(deriveTelemetryMode(inputs())).toBe(TelemetryMode.Unresolved)
    })

    it("lets the server's Anon override a stale persisted Enhanced (multi-device)", () => {
      expect(
        deriveTelemetryMode(inputs({ persistedMode: "enhanced", serverMode: "anon" })),
      ).toBe(TelemetryMode.Anon)
    })

    it("lets a local switch to Anon win over the server's stale Enhanced", () => {
      // The window between choosing incognito here and the push landing. AD-25's literal
      // precedence would read Enhanced from the stale server answer; deny wins instead.
      expect(
        deriveTelemetryMode(inputs({ persistedMode: "anon", serverMode: "enhanced" })),
      ).toBe(TelemetryMode.Anon)
    })

    it("does not resolve Custodial off an untrusted remote config (AD-9)", () => {
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
    resetEnablementForTesting()
    resetPlatformIdentityForTesting()
    setTelemetryRolloutEnabled(true)
  })

  it("starts closed, and stays closed until a mode is resolved", async () => {
    await initializeTelemetryGate()

    expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
    expect(setCollectionEnabled).toHaveBeenCalledWith(false)
    expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
  })

  describe("FR-70 / AD-24 — the gate is mode × the row's `modes` column", () => {
    const settlement = TelemetryEvent.PaymentSettled
    const legacy = TelemetryEvent.BackupCompleted
    const platform = "screen_view"

    it.each([
      { mode: TelemetryMode.Custodial, settlement: true, legacy: true, platform: true },
      { mode: TelemetryMode.Enhanced, settlement: true, legacy: false, platform: false },
      { mode: TelemetryMode.Anon, settlement: false, legacy: false, platform: false },
      {
        mode: TelemetryMode.Unresolved,
        settlement: false,
        legacy: false,
        platform: false,
      },
    ])(
      "$mode — settlement: $settlement, legacy pending review: $legacy, non-contract: $platform",
      async ({ mode, ...expected }) => {
        await resolveTelemetryMode(mode)

        expect({
          settlement: isEventPermitted(settlement),
          legacy: isEventPermitted(legacy),
          platform: isEventPermitted(platform),
        }).toEqual(expected)
      },
    )

    it("runs platform collection on Custodial alone", async () => {
      // CD-7. The 09-11 attempt to keep Enhanced on Firebase failed on Q13: the SDK cannot
      // suppress its reserved automatic events while logEvent() is live (verified against
      // @react-native-firebase/analytics@23.3.1 — see platform-analytics.ts).
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

  describe("AD-28 / AD-30 — the two switches sit in front of the gate", () => {
    it("permits nothing until the rollout flag is on", async () => {
      resetEnablementForTesting()
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      expect(isTelemetryEnabled()).toBe(false)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(false)
      expect(isDrainPermitted()).toBe(false)

      // Anchor: the same mode permits once the flag turns on.
      setTelemetryRolloutEnabled(true)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(true)
      expect(isDrainPermitted()).toBe(true)
    })

    it("engages the kill switch on a server `false` and never disengages it", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      const engaged = jest.fn()
      onKillSwitchEngaged(engaged)

      expect(applyServerKillSwitch(true)).toBe(false)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(true)

      expect(applyServerKillSwitch(false)).toBe(true)
      expect(engaged).toHaveBeenCalledTimes(1)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(false)
      expect(isDrainPermitted()).toBe(false)

      // One-directional: a later `true` changes nothing, and the listener does not refire.
      expect(applyServerKillSwitch(true)).toBe(true)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(false)
      expect(engaged).toHaveBeenCalledTimes(1)
    })

    it("restores an engaged switch from persistence without a fetch", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      restoreKillSwitch(true)

      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(false)
      restoreKillSwitch(false)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(false)
    })

    it("counts what the switches suppress, locally", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      applyServerKillSwitch(false)

      isEventPermitted(TelemetryEvent.PaymentSettled)

      expect(getDiagnosticCounters().suppressedEvents).toBe(1)
    })
  })

  describe("AD-16 — no user-scoped identity survives into a self-custodial session", () => {
    it("clears the analytics user id when a self-custodial account activates", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)
      setUserId.mockClear()

      await resolveTelemetryMode(TelemetryMode.Enhanced)

      expect(setUserId).toHaveBeenCalledWith(null)
    })

    it("clears every user property, not only the id", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)
      setCustodialAnalyticsIdentity({ properties: { hasUsername: "true", extra: "x" } })
      setUserProperties.mockClear()

      await resolveTelemetryMode(TelemetryMode.Anon)

      const [cleared] = setUserProperties.mock.calls.at(-1) ?? [{}]
      expect(cleared).toMatchObject({
        hasUsername: null,
        network: null,
        accountLevel: null,
        galoyInstance: null,
        extra: null,
      })
    })

    it("refuses an identity write that lands after the switch away from Custodial", async () => {
      // The container's effects run on GraphQL, config and level changes, any of which can
      // fire after a self-custodial account activates. Clearing once is not enough; the
      // setter has to say no.
      await resolveTelemetryMode(TelemetryMode.Custodial)
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      setUserId.mockClear()
      setUserProperties.mockClear()

      setCustodialAnalyticsIdentity({
        userId: "ledger-id",
        properties: { network: "mainnet" },
      })

      expect(setUserId).not.toHaveBeenCalled()
      expect(setUserProperties).not.toHaveBeenCalled()
    })

    it("refuses the write the instant the mode moves, before the queued clear runs", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial) // permission granted and settled
      resolveTelemetryMode(TelemetryMode.Anon) // not awaited: the clear is still queued
      setUserId.mockClear()

      setCustodialAnalyticsIdentity({ userId: "ledger-id" })

      expect(setUserId).not.toHaveBeenCalled()
    })

    it.each([{ mode: TelemetryMode.Unresolved }, { mode: TelemetryMode.Anon }])(
      "refuses identity writes under $mode",
      async ({ mode }) => {
        await resolveTelemetryMode(mode)

        setCustodialAnalyticsIdentity({ userId: "ledger-id" })

        expect(setUserId).not.toHaveBeenCalledWith("ledger-id")
      },
    )

    it("accepts identity writes while the session is custodial (anchor)", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)

      setCustodialAnalyticsIdentity({ userId: "ledger-id" })

      expect(setUserId).toHaveBeenCalledWith("ledger-id")
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

      await resolveTelemetryMode(TelemetryMode.Anon)
      expect(discard).toHaveBeenCalledTimes(1)
    })

    it("stops capture the instant the mode changes, not when the discard finishes", () => {
      resolveTelemetryMode(TelemetryMode.Enhanced)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(true)

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

  describe("AD-30 — mode-resolution latency is measured", () => {
    it("records how long the device sat in Unresolved after initialisation", async () => {
      await initializeTelemetryGate()
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      expect(getDiagnosticCounters().modeResolutionLatencyMs).toBeGreaterThanOrEqual(0)
    })
  })
})
