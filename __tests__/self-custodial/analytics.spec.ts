/* eslint-disable camelcase */
import analytics from "@react-native-firebase/analytics"
import RNFS from "react-native-fs"

import {
  logSelfCustodialBackupCompleted,
  logSelfCustodialRestoreCompleted,
  logSelfCustodialRolloutExposed,
  logSelfCustodialStableBalanceActivated,
} from "@app/self-custodial/analytics"
import { resetDiagnosticsForTesting } from "@app/telemetry/diagnostics"
import {
  resetEnablementForTesting,
  setTelemetryRolloutEnabled,
} from "@app/telemetry/enablement"
import { setActiveOutbox } from "@app/telemetry/index"
import {
  resetTelemetryModeForTesting,
  resolveTelemetryMode,
  TelemetryMode,
} from "@app/telemetry/mode"
import {
  createOutboxStore,
  resetOutboxCountersForTesting,
} from "@app/telemetry/outbox/store"

const logEvent = analytics().logEvent as jest.Mock
const mockFs = RNFS as unknown as { __resetMockFileSystem: () => void }

const DIR = "/mock/documents/blink-telemetry-outbox-regtest/legacy"

/**
 * AD-24: these four used to call Firebase directly. They now go through the boundary, so
 * what a test can assert is what the boundary does with them — hands them to GA4 on
 * Custodial, and holds them on Enhanced until their row passes privacy review.
 */
describe("self-custodial analytics helpers (AD-24)", () => {
  let store: ReturnType<typeof createOutboxStore>

  beforeEach(async () => {
    jest.clearAllMocks()
    mockFs.__resetMockFileSystem()
    resetTelemetryModeForTesting()
    resetDiagnosticsForTesting()
    resetOutboxCountersForTesting()
    resetEnablementForTesting()
    setTelemetryRolloutEnabled(true)
    store = createOutboxStore(DIR)
    setActiveOutbox(store)
    await resolveTelemetryMode(TelemetryMode.Custodial)
  })

  afterEach(() => {
    setActiveOutbox(null)
  })

  const paramsSentFor = (event: string) =>
    logEvent.mock.calls.find(([name]) => name === event)?.[1] as
      | Record<string, unknown>
      | undefined

  describe("logSelfCustodialBackupCompleted", () => {
    it("emits 'self_custodial_backup_completed' with snake_case backup_method", () => {
      logSelfCustodialBackupCompleted({ backupMethod: "manual" })

      expect(paramsSentFor("self_custodial_backup_completed")).toMatchObject({
        backup_method: "manual",
        wallet_provider: "custodial",
      })
    })

    it("propagates each backup method literal verbatim", () => {
      logSelfCustodialBackupCompleted({ backupMethod: "google_drive" })
      logSelfCustodialBackupCompleted({ backupMethod: "icloud" })

      const sent = logEvent.mock.calls.map(([, params]) => params.backup_method)
      expect(sent).toEqual(["google_drive", "icloud"])
    })
  })

  describe("logSelfCustodialRestoreCompleted", () => {
    it("emits 'self_custodial_restore_completed' with only the contract's common fields", () => {
      logSelfCustodialRestoreCompleted()

      expect(
        Object.keys(paramsSentFor("self_custodial_restore_completed") ?? {}).sort(),
      ).toEqual(["event_version", "telemetry_event_id", "wallet_provider"])
    })
  })

  describe("logSelfCustodialStableBalanceActivated", () => {
    it("emits 'self_custodial_stable_balance_activated' with the label", () => {
      logSelfCustodialStableBalanceActivated({ label: "USDB" })

      expect(paramsSentFor("self_custodial_stable_balance_activated")).toMatchObject({
        label: "USDB",
      })
    })
  })

  describe("logSelfCustodialRolloutExposed", () => {
    it("renames camelCase params to snake_case payload keys", () => {
      logSelfCustodialRolloutExposed({
        nonCustodialEnabled: true,
        stableBalanceEnabled: false,
        hasCustodialAccount: true,
      })

      expect(paramsSentFor("self_custodial_rollout_exposed")).toMatchObject({
        non_custodial_enabled: true,
        stable_balance_enabled: false,
        has_custodial_account: true,
      })
    })

    it("preserves false booleans (does not coerce to undefined or omit keys)", () => {
      logSelfCustodialRolloutExposed({
        nonCustodialEnabled: false,
        stableBalanceEnabled: false,
        hasCustodialAccount: false,
      })

      expect(paramsSentFor("self_custodial_rollout_exposed")).toMatchObject({
        non_custodial_enabled: false,
        stable_balance_enabled: false,
        has_custodial_account: false,
      })
    })
  })

  describe("the ruling, in behaviour", () => {
    it("holds every legacy event on Enhanced until its row passes review", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      logEvent.mockClear()

      logSelfCustodialBackupCompleted({ backupMethod: "manual" })
      logSelfCustodialRestoreCompleted()
      logSelfCustodialStableBalanceActivated({ label: "USDB" })
      logSelfCustodialRolloutExposed({
        nonCustodialEnabled: true,
        stableBalanceEnabled: true,
        hasCustodialAccount: false,
      })

      expect(logEvent).not.toHaveBeenCalled()
      expect(await store.pending()).toEqual([])
    })

    it("emits nothing from a device with no resolved mode", async () => {
      await resolveTelemetryMode(TelemetryMode.Unresolved)
      logEvent.mockClear()

      logSelfCustodialRestoreCompleted()

      expect(logEvent).not.toHaveBeenCalled()
      expect(await store.pending()).toEqual([])
    })
  })
})
