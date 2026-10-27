/* eslint-disable camelcase */
import analytics from "@react-native-firebase/analytics"
import RNFS from "react-native-fs"
import Crypto from "react-native-quick-crypto"

import {
  flushDeferredTelemetry,
  logSelfCustodialBackupCompleted,
  logSelfCustodialRestoreCompleted,
  resetDeferredTelemetryForTesting,
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
const randomUUID = Crypto.randomUUID as jest.Mock
const mockFs = RNFS as unknown as { __resetMockFileSystem: () => void }

const DIR = "/mock/documents/blink-telemetry-outbox-regtest/legacy"

/**
 * These four used to call Firebase directly. They now go through the boundary, so what a
 * test can assert is what the boundary does with them — hands them to GA4 on Custodial, and
 * files them in the outbox on Enhanced.
 */
describe("self-custodial analytics helpers", () => {
  let store: ReturnType<typeof createOutboxStore>

  beforeEach(async () => {
    jest.clearAllMocks()
    mockFs.__resetMockFileSystem()
    resetTelemetryModeForTesting()
    resetDiagnosticsForTesting()
    resetOutboxCountersForTesting()
    resetEnablementForTesting()
    resetDeferredTelemetryForTesting()
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
    // A restore logs straight after asking for the restored account to become active, while
    // the mode is still the previous account's. The fact waits for the telemetry mount to
    // report that its account is active and settled.
    const RESTORED = "restored-account"

    it("emits nothing while its account is not active yet", () => {
      logSelfCustodialRestoreCompleted({ accountId: RESTORED })

      expect(logEvent).not.toHaveBeenCalled()
    })

    it("never reaches GA4, even if released while the device is custodial", async () => {
      logSelfCustodialRestoreCompleted({ accountId: RESTORED })

      flushDeferredTelemetry(RESTORED)

      expect(logEvent).not.toHaveBeenCalled()
      expect(await store.pending()).toEqual([])
    })

    it("lands in the outbox with only the contract's common fields once its account is Enhanced", async () => {
      logSelfCustodialRestoreCompleted({ accountId: RESTORED })
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      flushDeferredTelemetry(RESTORED)

      const [record] = await store.pending()
      expect(record.event).toBe("self_custodial_restore_completed")
      expect(Object.keys(record.payload).sort()).toEqual([
        "event_version",
        "telemetry_event_id",
        "wallet_provider",
      ])
      expect(record.payload.wallet_provider).toBe("spark")
      expect(logEvent).not.toHaveBeenCalled()
    })

    it("is dropped when its account comes up incognito", async () => {
      logSelfCustodialRestoreCompleted({ accountId: RESTORED })
      await resolveTelemetryMode(TelemetryMode.Anon)

      flushDeferredTelemetry(RESTORED)

      expect(await store.pending()).toEqual([])
    })

    it("waits for its own account, and is emitted exactly once", async () => {
      let n = 0
      randomUUID.mockImplementation(() => {
        n += 1
        return `00000000-0000-4000-8000-00000000000${n}`
      })
      logSelfCustodialRestoreCompleted({ accountId: RESTORED })
      await resolveTelemetryMode(TelemetryMode.Enhanced)

      flushDeferredTelemetry("some-other-account")
      expect(await store.pending()).toEqual([])

      flushDeferredTelemetry(RESTORED)
      flushDeferredTelemetry(RESTORED)

      randomUUID.mockImplementation(() => "00000000-0000-4000-8000-000000000000")
      expect(await store.pending()).toHaveLength(1)
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
    it("sends every legacy event to the outbox on Enhanced, never to Firebase", async () => {
      await resolveTelemetryMode(TelemetryMode.Enhanced)
      logEvent.mockClear()
      // A distinct id each, because the outbox keys its records on the id: four events
      // minted with the shared mock id are one record, which would hide three of them.
      randomUUID
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000002")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000003")
        .mockReturnValueOnce("00000000-0000-4000-8000-000000000004")

      logSelfCustodialBackupCompleted({ backupMethod: "manual" })
      logSelfCustodialRestoreCompleted({ accountId: "restored-account" })
      flushDeferredTelemetry("restored-account")
      logSelfCustodialStableBalanceActivated({ label: "USDB" })
      logSelfCustodialRolloutExposed({
        nonCustodialEnabled: true,
        stableBalanceEnabled: true,
        hasCustodialAccount: false,
      })

      const queued = await store.pending()
      expect(queued.map((record) => record.event).sort()).toEqual([
        "self_custodial_backup_completed",
        "self_custodial_restore_completed",
        "self_custodial_rollout_exposed",
        "self_custodial_stable_balance_activated",
      ])
      expect(logEvent).not.toHaveBeenCalled()
    })

    it("emits nothing from a device with no resolved mode", async () => {
      await resolveTelemetryMode(TelemetryMode.Unresolved)
      logEvent.mockClear()

      logSelfCustodialRestoreCompleted({ accountId: "restored-account" })
      flushDeferredTelemetry("restored-account")

      expect(logEvent).not.toHaveBeenCalled()
      expect(await store.pending()).toEqual([])
    })
  })
})
