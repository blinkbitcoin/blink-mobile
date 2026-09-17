// The tsconfig's `types` includes @wdio/mocha-framework, whose global `it` shadows Jest's
// and has no `.each`. Same workaround as __tests__/screens/send-destination.spec.tsx.
import { it } from "@jest/globals"

import analytics from "@react-native-firebase/analytics"

import { TelemetryEvent } from "@app/telemetry/contract"
import {
  getDiagnosticCounters,
  mayTransmitDiagnostics,
  resetDiagnosticsForTesting,
} from "@app/telemetry/diagnostics"
import {
  DiagnosticsDisposition,
  getDiagnosticsDisposition,
} from "@app/telemetry/transmissibility"
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
    it("permits nothing from an Enhanced device until the rollout flag is on", async () => {
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

    it("leaves the custodial contract events alone whatever the switches say — they predate P2", async () => {
      resetEnablementForTesting()
      applyServerKillSwitch(false)
      await resolveTelemetryMode(TelemetryMode.Custodial)

      for (const event of [
        TelemetryEvent.BackupCompleted,
        TelemetryEvent.RestoreCompleted,
        TelemetryEvent.StableBalanceActivated,
        TelemetryEvent.RolloutExposed,
        TelemetryEvent.PaymentSettled,
      ]) {
        expect(isEventPermitted(event)).toBe(true)
      }
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

    it.each([
      { mode: TelemetryMode.Custodial, disposition: DiagnosticsDisposition.Permitted },
      { mode: TelemetryMode.Enhanced, disposition: DiagnosticsDisposition.Permitted },
      { mode: TelemetryMode.Anon, disposition: DiagnosticsDisposition.Denied },
      { mode: TelemetryMode.Unresolved, disposition: DiagnosticsDisposition.Unresolved },
    ])(
      "resolving $mode sets the diagnostic disposition to $disposition (AD-13)",
      async ({ mode, disposition }) => {
        // Anon is *denied*, not merely unresolved: the sink holds under one and drops under
        // the other, and an incognito device's errors must never be held for a later grant.
        await resolveTelemetryMode(TelemetryMode.Enhanced)
        await resolveTelemetryMode(mode)

        expect(getDiagnosticsDisposition()).toBe(disposition)
      },
    )

    it("silences an Enhanced device's diagnostics when the switch engages (NFR-O4)", async () => {
      // "Self-custodial telemetry collection stops" is every transmission a self-custodial
      // device makes: the boundary's events, the drain, and Crashlytics too.
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      expect(mayTransmitDiagnostics()).toBe(true)

      applyServerKillSwitch(false)

      expect(mayTransmitDiagnostics()).toBe(false)
      expect(isDrainPermitted()).toBe(false)
    })

    it("silences them from launch when the switch is restored from persistence", async () => {
      restoreKillSwitch(true)
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      expect(mayTransmitDiagnostics()).toBe(false)
    })

    it("leaves a custodial device's diagnostics alone — the switch is self-custodial rollback", async () => {
      applyServerKillSwitch(false)
      await resolveTelemetryMode(TelemetryMode.Custodial)

      expect(mayTransmitDiagnostics()).toBe(true)
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

    it("applies the identity the container asked for before the mode resolved, once it does", async () => {
      // The fifth review's second blocker. The container's effects run on the first
      // commit — the ledger id out of the persisted cache, the instance name from config —
      // and do not run again while those values stand; permission arrives later, once the
      // mode has resolved and its queued side effects have run.
      setCustodialAnalyticsIdentity({ userId: "ledger-id" })
      setCustodialAnalyticsIdentity({ properties: { galoyInstance: "Blink" } })
      setCustodialAnalyticsIdentity({ properties: { hasUsername: "true" } })
      expect(setUserId).not.toHaveBeenCalledWith("ledger-id")

      await resolveTelemetryMode(TelemetryMode.Custodial)

      expect(setUserId).toHaveBeenCalledWith("ledger-id")
      expect(setUserProperties).toHaveBeenCalledWith(
        expect.objectContaining({ galoyInstance: "Blink", hasUsername: "true" }),
      )
    })

    it("applies it again after a round trip through a self-custodial account", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)
      setCustodialAnalyticsIdentity({
        userId: "ledger-id",
        properties: { network: "mainnet" },
      })
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      setUserId.mockClear()
      setUserProperties.mockClear()

      await resolveTelemetryMode(TelemetryMode.Custodial)

      expect(setUserId).toHaveBeenLastCalledWith("ledger-id")
      expect(setUserProperties).toHaveBeenLastCalledWith(
        expect.objectContaining({ network: "mainnet" }),
      )
    })

    it("replays nothing on a grant when nothing was ever asked for", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)

      expect(setUserId).not.toHaveBeenCalled()
      expect(setUserProperties).not.toHaveBeenCalled()
    })

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

  describe("FR-4 / FR-5 — closed before the discard, never reopened over one", () => {
    /** A discard held open by the test: the unlink is a disk operation and can be slow. */
    const suspendedDiscard = () => {
      let release: () => void = () => undefined
      const finished = new Promise<void>((resolve) => {
        release = resolve
      })
      onTelemetrySuppressed(() => finished)
      return { release }
    }

    it("closes collection and identity the instant the mode leaves Custodial, while the discard is still running", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)
      const discard = suspendedDiscard()
      setCollectionEnabled.mockClear()
      setUserId.mockClear()

      const transition = resolveTelemetryMode(TelemetryMode.Anon)

      // Synchronously — nothing awaited yet, and the discard has not finished.
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)
      expect(setUserId).toHaveBeenCalledWith(null)
      expect(isEventPermitted(TelemetryEvent.PaymentSettled)).toBe(false)

      discard.release()
      await transition
    })

    it("does not reopen collection until a pending discard has finished", async () => {
      await resolveTelemetryMode(TelemetryMode.Custodial)
      const discard = suspendedDiscard()
      resolveTelemetryMode(TelemetryMode.Anon)
      setCollectionEnabled.mockClear()

      const reopened = resolveTelemetryMode(TelemetryMode.Custodial)
      await Promise.resolve()
      await Promise.resolve()

      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)

      discard.release()
      await reopened

      expect(setCollectionEnabled).toHaveBeenLastCalledWith(true)
    })

    it("never reopens for a Custodial that was overtaken by Anon before its turn", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      setCollectionEnabled.mockClear()

      resolveTelemetryMode(TelemetryMode.Custodial)
      await resolveTelemetryMode(TelemetryMode.Anon)

      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(false)
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
