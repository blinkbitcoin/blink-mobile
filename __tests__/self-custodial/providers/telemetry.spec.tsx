import React from "react"
import { AppState } from "react-native"

import { act, render, waitFor } from "@testing-library/react-native"
import { Network } from "@breeztech/breez-sdk-spark-react-native"
import analytics from "@react-native-firebase/analytics"
import RNFS from "react-native-fs"

import {
  logSelfCustodialRestoreCompleted,
  resetDeferredTelemetryForTesting,
} from "@app/self-custodial/analytics"
import { telemetryOutboxDirFor } from "@app/self-custodial/config"
import { SelfCustodialTelemetryMount } from "@app/self-custodial/providers/telemetry"
import {
  RailType,
  TelemetryDirection,
  TelemetryEvent,
  WalletProvider,
  type ContractPayload,
} from "@app/telemetry/contract"
import { resetDiagnosticsForTesting } from "@app/telemetry/diagnostics"
import {
  resetPlatformIdentityForTesting,
  setCustodialAnalyticsIdentity,
} from "@app/telemetry/platform-analytics"
import {
  applyServerKillSwitch,
  isTelemetryEnabled,
  resetEnablementForTesting,
} from "@app/telemetry/enablement"
import { captureTelemetryFact, setActiveOutbox } from "@app/telemetry/index"
import {
  getTelemetryMode,
  resetTelemetryModeForTesting,
  TelemetryMode,
} from "@app/telemetry/mode"
import { resetDrainStateForTesting } from "@app/telemetry/outbox/drain"
import { OutboxState } from "@app/telemetry/outbox/record"
import {
  createOutboxStore,
  resetOutboxCountersForTesting,
} from "@app/telemetry/outbox/store"
import {
  registerTelemetryTransport,
  resetTelemetryTransportForTesting,
  type SubmitResult,
  getTelemetryTransport,
} from "@app/telemetry/transport"
import {
  DiagnosticsDisposition,
  getDiagnosticsDisposition,
} from "@app/telemetry/transmissibility"
import { AccountMode } from "@app/types/account"
import { AccountType, ActiveWalletStatus } from "@app/types/wallet"

const setCollectionEnabled = analytics().setAnalyticsCollectionEnabled as jest.Mock

const ACCOUNT_ID = "self-custodial-1"
const OTHER_ACCOUNT_ID = "self-custodial-2"

let mockActiveAccount: { id: string; type: AccountType } | undefined
let mockSelfCustodialEntries: { id: string }[]
let mockSelfCustodialIndex: "pending" | "unreadable" | "known"
let mockAccountMode: AccountMode | null
let mockServerModes: Record<string, AccountMode>
let mockRemoteConfigTrusted: boolean
let mockTelemetryEnabled: boolean
let mockKillSwitchEngaged: boolean | undefined
let mockIdentityApplied: boolean | undefined
let mockConnectedAccountId: string | null
let mockWalletStatus: ActiveWalletStatus
const mockUpdateState = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  SelfCustodialIndexState: {
    Pending: "pending",
    Unreadable: "unreadable",
    Known: "known",
  },
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount,
    selfCustodialEntries: mockSelfCustodialEntries,
    selfCustodialIndex: mockSelfCustodialIndex,
  }),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ accountMode: mockAccountMode }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: {
      selfCustodialServerAccountModeByAccountId: mockServerModes,
      telemetryKillSwitchEngaged: mockKillSwitchEngaged,
      telemetryPlatformIdentityApplied: mockIdentityApplied,
    },
    updateState: mockUpdateState,
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    isNonCustodialFlagSettled: mockRemoteConfigTrusted,
    telemetryEnabled: mockTelemetryEnabled,
  }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    connectedAccountId: mockConnectedAccountId,
    status: mockWalletStatus,
  }),
}))

const mockRelaySubmit = jest.fn<Promise<SubmitResult>, [ContractPayload]>(() =>
  Promise.resolve({ kind: "acknowledged", ackedAt: 1 }),
)
const mockCreateRelay = jest.fn((url: string) => ({
  name: "blink-relay" as const,
  ackSemantics: "application" as const,
  attachesNoImplicitIdentity: true as const,
  submit: mockRelaySubmit,
  url,
}))
jest.mock("@app/self-custodial/telemetry-relay", () => ({
  createTelemetryRelayTransport: (url: string) => mockCreateRelay(url),
}))

let mockNetwork: Network = Network.Regtest
jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

const mockRefreshKillSwitch = jest.fn((_serverUrl: string) => Promise.resolve())
jest.mock("@app/self-custodial/lnurl-telemetry-config", () => ({
  refreshTelemetryKillSwitch: (serverUrl: string) => mockRefreshKillSwitch(serverUrl),
}))

const mockFs = RNFS as unknown as { __resetMockFileSystem: () => void }

const DIR = telemetryOutboxDirFor(ACCOUNT_ID, "regtest" as unknown as Network)
const OTHER_DIR = telemetryOutboxDirFor(OTHER_ACCOUNT_ID, "regtest" as unknown as Network)

const queuedRecord = (id = "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7f8") => ({
  telemetryEventId: id,
  event: TelemetryEvent.PaymentSettled,
  version: 1,
  payload: {
    /* eslint-disable camelcase */
    event_version: 1,
    wallet_provider: WalletProvider.Spark,
    direction: TelemetryDirection.Send,
    rail_type: RailType.Lightning,
    telemetry_event_id: id,
    /* eslint-enable camelcase */
  },
  sdkPaymentId: `sdk-${id}`,
  queuedAt: Date.now(),
  state: OutboxState.Queued,
})

/**
 * The provider registers the adapter itself, so a test cannot install one beside it: the
 * mount would replace it. The relay factory is mocked instead, which also keeps the spec
 * off the network.
 */
const ackingTransport = () => {
  mockRelaySubmit.mockImplementation(() =>
    Promise.resolve({ kind: "acknowledged", ackedAt: 1 }),
  )
  registerTelemetryTransport({
    name: "blink-relay",
    ackSemantics: "application",
    attachesNoImplicitIdentity: true,
    submit: mockRelaySubmit,
  })
  return mockRelaySubmit
}

describe("SelfCustodialTelemetryMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFs.__resetMockFileSystem()
    resetTelemetryModeForTesting()
    resetTelemetryTransportForTesting()
    resetOutboxCountersForTesting()
    resetDiagnosticsForTesting()
    resetDrainStateForTesting()
    resetEnablementForTesting()
    setActiveOutbox(null)

    mockActiveAccount = { id: ACCOUNT_ID, type: AccountType.SelfCustodial }
    mockSelfCustodialEntries = [{ id: ACCOUNT_ID }]
    mockSelfCustodialIndex = "known"
    mockAccountMode = AccountMode.Enhanced
    mockServerModes = {}
    mockRemoteConfigTrusted = true
    mockTelemetryEnabled = true
    mockKillSwitchEngaged = undefined
    mockIdentityApplied = false
    mockConnectedAccountId = ACCOUNT_ID
    mockWalletStatus = ActiveWalletStatus.Ready
  })

  afterEach(() => {
    setActiveOutbox(null)
  })

  describe("three inputs, deny wins", () => {
    it("resolves the mode of whichever account is active", async () => {
      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))
    })

    it("resolves an account with no mode anywhere as Unresolved, not Enhanced", async () => {
      mockAccountMode = null

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved))
    })

    it("lets the server's Anon override what this device persisted", async () => {
      mockAccountMode = AccountMode.Enhanced
      mockServerModes = { [ACCOUNT_ID]: AccountMode.Anon }

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Anon))
    })

    it("resolves Enhanced from the server alone, before this device has persisted it", async () => {
      mockAccountMode = null
      mockServerModes = { [ACCOUNT_ID]: AccountMode.Enhanced }

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))
    })
  })

  describe("discard on activation, and finish what the last run started", () => {
    it("discards a queue left by an account that switched to incognito while inactive", async () => {
      await createOutboxStore(DIR).enqueue(queuedRecord())
      mockAccountMode = AccountMode.Anon
      const submit = ackingTransport()

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Anon))
      await waitFor(async () =>
        expect(await createOutboxStore(DIR).pending()).toEqual([]),
      )
      expect(submit).not.toHaveBeenCalled()
    })

    it("discards a queue on a cold start straight into Unresolved", async () => {
      // No mode transition fires the suppression listener here — the gate starts
      // Unresolved and stays there — so the activation check has to do it.
      await createOutboxStore(DIR).enqueue(queuedRecord())
      mockAccountMode = null

      render(<SelfCustodialTelemetryMount />)

      await waitFor(async () =>
        expect(await createOutboxStore(DIR).pending()).toEqual([]),
      )
    })

    it("re-runs a discard the last run left a tombstone for, even under Enhanced", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(queuedRecord())
      await RNFS.writeFile(`${DIR}.discard`, "1", "utf8")

      render(<SelfCustodialTelemetryMount />)

      await waitFor(async () => expect(await store.hasPendingDiscard()).toBe(false))
      expect(await store.pending()).toEqual([])
    })

    it("sweeps, on mount, what a deleted account's retirement could not remove", async () => {
      // No store will ever be created for a deleted account again, so its leftovers are
      // the parent sweep's to remove: a condemned queue whose unlink failed, and a
      // tombstone whose directory is gone.
      const parent = DIR.slice(0, DIR.lastIndexOf("/"))
      await RNFS.writeFile(`${parent}/gone-account.condemned-1/p-x.json`, "{}", "utf8")
      await RNFS.writeFile(`${parent}/gone-account.discard`, "1", "utf8")

      render(<SelfCustodialTelemetryMount />)

      await waitFor(async () => {
        expect(await RNFS.exists(`${parent}/gone-account.condemned-1`)).toBe(false)
      })
      expect(await RNFS.exists(`${parent}/gone-account.discard`)).toBe(false)
    })

    it("drains that same queue when the account is still Enhanced", async () => {
      await createOutboxStore(DIR).enqueue(queuedRecord())
      const submit = ackingTransport()

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    })

    it("touches only the active account's queue when two accounts hold records", async () => {
      await createOutboxStore(DIR).enqueue(
        queuedRecord("3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e701"),
      )
      await createOutboxStore(OTHER_DIR).enqueue(
        queuedRecord("3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e702"),
      )
      mockActiveAccount = { id: OTHER_ACCOUNT_ID, type: AccountType.SelfCustodial }
      mockConnectedAccountId = OTHER_ACCOUNT_ID
      mockSelfCustodialEntries = [{ id: ACCOUNT_ID }, { id: OTHER_ACCOUNT_ID }]
      mockAccountMode = AccountMode.Anon

      render(<SelfCustodialTelemetryMount />)

      await waitFor(async () =>
        expect(await createOutboxStore(OTHER_DIR).pending()).toEqual([]),
      )
      expect(await createOutboxStore(DIR).pending()).toHaveLength(1)
    })
  })

  describe("the drain's triggers are SDK connect, emission and foreground", () => {
    it("does not drain while the SDK is connected for a different account", async () => {
      await createOutboxStore(DIR).enqueue(queuedRecord())
      const submit = ackingTransport()
      mockConnectedAccountId = OTHER_ACCOUNT_ID

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      expect(submit).not.toHaveBeenCalled()
    })

    it("does not drain while the wallet is offline", async () => {
      await createOutboxStore(DIR).enqueue(queuedRecord())
      const submit = ackingTransport()
      mockWalletStatus = ActiveWalletStatus.Offline

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      expect(submit).not.toHaveBeenCalled()
    })

    it("drains on a successful emission", async () => {
      const submit = ackingTransport()
      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))
      resetDrainStateForTesting()

      act(() => {
        captureTelemetryFact(
          {
            event: TelemetryEvent.ReferralCompleted,
            telemetryEventId: "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7f9",
            walletProvider: WalletProvider.Spark,
          },
          null,
        )
      })

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    })

    it("drains when the app comes to the foreground", async () => {
      const submit = ackingTransport()
      const addEventListener = AppState.addEventListener as jest.Mock

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))
      await createOutboxStore(DIR).enqueue(queuedRecord())
      resetDrainStateForTesting()

      // The preset's AppState mock records the handler; fire it as the OS would.
      const handlers = addEventListener.mock.calls
        .filter(([type]) => type === "change")
        .map(([, handler]) => handler as (state: string) => void)
      expect(handlers.length).toBeGreaterThan(0)
      act(() => {
        for (const handler of handlers) handler("active")
      })

      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
    })
  })

  describe("the kill switch reaches an account that settled its mode long ago", () => {
    it("refreshes the switch on activation of an established Enhanced account", async () => {
      // No /recover call ever happens for this account: its mode is persisted and
      // confirmed. The switch has to arrive some other way, on a schedule the device
      // actually keeps.
      mockServerModes = { [ACCOUNT_ID]: AccountMode.Enhanced }

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(mockRefreshKillSwitch).toHaveBeenCalledTimes(1))
      expect(mockRefreshKillSwitch).toHaveBeenCalledWith("https://staging.blink.sv")
    })

    it("refreshes it again when the app comes to the foreground", async () => {
      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(mockRefreshKillSwitch).toHaveBeenCalledTimes(1))

      const handlers = (AppState.addEventListener as jest.Mock).mock.calls
        .filter(([type]) => type === "change")
        .map(([, handler]) => handler as (state: string) => void)
      act(() => {
        for (const handler of handlers) handler("active")
      })

      await waitFor(() =>
        expect(mockRefreshKillSwitch.mock.calls.length).toBeGreaterThan(1),
      )
    })

    it("never fetches from an incognito device — a request is a transmission too", async () => {
      mockAccountMode = AccountMode.Anon

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Anon))

      expect(mockRefreshKillSwitch).not.toHaveBeenCalled()
    })

    it("never fetches while the mode is unresolved", async () => {
      mockAccountMode = null

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved))

      expect(mockRefreshKillSwitch).not.toHaveBeenCalled()
    })

    it("never fetches from a custodial device — the switch is the self-custodial pipeline's", async () => {
      // A device with no self-custodial account has nothing the switch could roll back,
      // and no business calling the LNURL server on every foreground.
      mockActiveAccount = { id: "custodial-default", type: AccountType.Custodial }
      mockSelfCustodialEntries = []

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Custodial))

      expect(mockRefreshKillSwitch).not.toHaveBeenCalled()
    })
  })

  describe("every account's queue expires, active or not", () => {
    it("sweeps an inactive account's expired records on mount", async () => {
      await createOutboxStore(OTHER_DIR).enqueue({
        ...queuedRecord("3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7a1"),
        queuedAt: Date.now() - 73 * 60 * 60 * 1000,
      })
      mockSelfCustodialEntries = [{ id: ACCOUNT_ID }, { id: OTHER_ACCOUNT_ID }]

      render(<SelfCustodialTelemetryMount />)

      await waitFor(async () =>
        expect(await createOutboxStore(OTHER_DIR).depth()).toBe(0),
      )
    })
  })

  describe("the switches", () => {
    it("restores a persisted kill switch, so nothing emits without a fetch", async () => {
      mockKillSwitchEngaged = true

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      expect(isTelemetryEnabled()).toBe(false)
    })

    it("persists the switch the moment the server engages it", async () => {
      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(isTelemetryEnabled()).toBe(true))

      act(() => {
        applyServerKillSwitch(false)
      })

      expect(mockUpdateState).toHaveBeenCalled()
      const updater = mockUpdateState.mock.calls.at(-1)?.[0]
      expect(updater({ schemaVersion: 22 })).toMatchObject({
        telemetryKillSwitchEngaged: true,
      })
    })

    it("opens platform collection on Enhanced before the rollout flag lands, and keeps it open", async () => {
      // On a real launch the mode resolves from what the device persisted, and the flag
      // arrives from the network afterwards.
      mockTelemetryEnabled = false
      const view = render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(true)

      mockTelemetryEnabled = true
      view.rerender(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(isTelemetryEnabled()).toBe(true))

      expect(setCollectionEnabled).toHaveBeenLastCalledWith(true)
    })

    it("never opens collection for an Enhanced device that launches already rolled back", async () => {
      // The restore has to land before the first resolution reads the switch. This pins the
      // order of the two effects rather than trusting it.
      mockKillSwitchEngaged = true

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
    })

    it("keeps everything off until the rollout flag is on", async () => {
      mockTelemetryEnabled = false

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      expect(isTelemetryEnabled()).toBe(false)
    })
  })

  it("leaves the mode Unresolved while no self-custodial account is active", async () => {
    mockActiveAccount = { id: "custodial-default", type: AccountType.Custodial }
    mockRemoteConfigTrusted = false

    render(<SelfCustodialTelemetryMount />)

    await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved))
  })

  describe("a device with no account at all", () => {
    it("resolves Custodial when it holds no self-custodial account — the funnel and its crashes are custodial telemetry", async () => {
      // A fresh install, or a logged-out device. Left Unresolved, nothing in a pre-auth
      // session could ever resolve it: the acquisition funnel's platform events would be
      // dropped and the sink would hold sign-up crashes for an answer that never came.
      mockActiveAccount = undefined
      mockSelfCustodialEntries = []

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Custodial))
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(true)
      expect(getDiagnosticsDisposition()).toBe(DiagnosticsDisposition.Permitted)
    })

    it("stays Unresolved between accounts when a self-custodial one is on the device", async () => {
      mockActiveAccount = undefined
      mockSelfCustodialEntries = [{ id: ACCOUNT_ID }]

      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved))
      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
    })
  })

  describe("before the registry has read the account index", () => {
    // The registry seeds an empty list until listSelfCustodialAccounts() lands, so "this
    // device holds no self-custodial account" is not yet an answer.
    it("keeps a logged-out device with an incognito wallet closed until the index is read", async () => {
      mockActiveAccount = undefined
      mockSelfCustodialEntries = []
      mockSelfCustodialIndex = "pending"
      const view = render(<SelfCustodialTelemetryMount />)
      await act(async () => {})
      expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)

      mockSelfCustodialEntries = [{ id: ACCOUNT_ID }]
      mockSelfCustodialIndex = "known"
      view.rerender(<SelfCustodialTelemetryMount />)
      await act(async () => {})

      expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
      expect(getDiagnosticsDisposition()).toBe(DiagnosticsDisposition.Unresolved)
    })

    it("opens a custodial-only device once the index says it holds nothing", async () => {
      mockActiveAccount = undefined
      mockSelfCustodialEntries = []
      mockSelfCustodialIndex = "pending"
      const view = render(<SelfCustodialTelemetryMount />)
      await act(async () => {})
      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)

      mockSelfCustodialIndex = "known"
      view.rerender(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Custodial))
      expect(setCollectionEnabled).toHaveBeenLastCalledWith(true)
    })

    it("counts an index that could not be read as holding a self-custodial account", async () => {
      mockActiveAccount = undefined
      mockSelfCustodialEntries = []
      mockSelfCustodialIndex = "unreadable"

      render(<SelfCustodialTelemetryMount />)
      await act(async () => {})

      expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved)
      expect(setCollectionEnabled).not.toHaveBeenCalledWith(true)
    })

    it("never passes through Custodial on a dual-account cold start", async () => {
      // A custodial user who also holds a self-custodial wallet: the index read lands
      // before the remote config fetch does.
      mockActiveAccount = { id: "custodial-default", type: AccountType.Custodial }
      mockSelfCustodialEntries = []
      mockSelfCustodialIndex = "pending"
      mockRemoteConfigTrusted = false
      const seen: string[] = []
      const view = render(<SelfCustodialTelemetryMount />)
      await act(async () => {})
      seen.push(getTelemetryMode())

      mockSelfCustodialEntries = [{ id: ACCOUNT_ID }]
      mockSelfCustodialIndex = "known"
      view.rerender(<SelfCustodialTelemetryMount />)
      await act(async () => {})
      seen.push(getTelemetryMode())

      mockRemoteConfigTrusted = true
      view.rerender(<SelfCustodialTelemetryMount />)
      await act(async () => {})
      seen.push(getTelemetryMode())

      expect(seen).toEqual([
        TelemetryMode.Unresolved,
        TelemetryMode.Unresolved,
        TelemetryMode.Custodial,
      ])
      expect(setCollectionEnabled.mock.calls.map((call) => call[0])).not.toContain(false)
    })
  })

  describe("the app-instance reset follows a persisted debt", () => {
    const resetAnalyticsData = analytics().resetAnalyticsData as jest.Mock
    const lastPersistedDebt = () => {
      const updaters = mockUpdateState.mock.calls.map((call) => call[0])
      const written = updaters
        .map((updater) => updater({ schemaVersion: 22 }))
        .filter((state) => "telemetryPlatformIdentityApplied" in state)
      return written.at(-1)?.telemetryPlatformIdentityApplied
    }

    beforeEach(() => {
      resetPlatformIdentityForTesting()
    })

    it("keeps the instance on an Enhanced launch whose debt is already paid", async () => {
      mockIdentityApplied = false

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      expect(resetAnalyticsData).not.toHaveBeenCalled()
    })

    it("pays an owed debt on the Enhanced launch, and persists that it is paid", async () => {
      mockIdentityApplied = true

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(lastPersistedDebt()).toBe(false))

      expect(resetAnalyticsData).toHaveBeenCalledTimes(1)
    })

    it("treats an install with no record as owing it", async () => {
      mockIdentityApplied = undefined

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      expect(resetAnalyticsData).toHaveBeenCalledTimes(1)
    })

    it("persists the debt when the ledger id is applied, so a later process pays it", async () => {
      mockActiveAccount = undefined
      mockSelfCustodialEntries = []
      mockIdentityApplied = false
      setCustodialAnalyticsIdentity({ userId: "ledger-account", properties: {} })

      render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Custodial))

      await waitFor(() => expect(lastPersistedDebt()).toBe(true))
    })

    it("never resets on a dual-account custodial cold start", async () => {
      mockActiveAccount = { id: "custodial-default", type: AccountType.Custodial }
      mockSelfCustodialEntries = []
      mockSelfCustodialIndex = "pending"
      mockRemoteConfigTrusted = false
      mockIdentityApplied = true
      const view = render(<SelfCustodialTelemetryMount />)
      await act(async () => {})

      mockSelfCustodialEntries = [{ id: ACCOUNT_ID }]
      mockSelfCustodialIndex = "known"
      view.rerender(<SelfCustodialTelemetryMount />)
      await act(async () => {})
      mockRemoteConfigTrusted = true
      view.rerender(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Custodial))

      expect(resetAnalyticsData).not.toHaveBeenCalled()
    })
  })

  describe("a restore logged before the account it activates is active", () => {
    beforeEach(() => {
      resetDeferredTelemetryForTesting()
    })

    it("files the restore under the restored account, and never hands it to GA4", async () => {
      // A custodial user restores a self-custodial wallet: the hook activates it and logs in
      // the same tick, before the switch has rendered.
      mockActiveAccount = { id: "custodial-default", type: AccountType.Custodial }
      // No drain, so the record stays where it was filed rather than going to the relay.
      mockConnectedAccountId = null
      const view = render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Custodial))
      const logEvent = analytics().logEvent as jest.Mock
      logEvent.mockClear()

      logSelfCustodialRestoreCompleted({ accountId: ACCOUNT_ID })
      mockActiveAccount = { id: ACCOUNT_ID, type: AccountType.SelfCustodial }
      view.rerender(<SelfCustodialTelemetryMount />)

      await waitFor(async () => {
        const queued = await createOutboxStore(DIR).pending()
        expect(queued.map((record) => record.event)).toContain(
          TelemetryEvent.RestoreCompleted,
        )
      })
      expect(logEvent).not.toHaveBeenCalledWith(
        TelemetryEvent.RestoreCompleted,
        expect.anything(),
      )
    })
  })

  describe("a filesystem that will not cooperate", () => {
    // None of these is recoverable from the provider, and none of them may take the screen
    // down with it: telemetry is never worth a render.
    it("mounts even when the inactive-account sweep cannot read the disk", async () => {
      mockSelfCustodialEntries = [{ id: ACCOUNT_ID }, { id: OTHER_ACCOUNT_ID }]
      const readDir = jest.spyOn(RNFS, "readDir").mockRejectedValue(new Error("EIO"))

      expect(() => render(<SelfCustodialTelemetryMount />)).not.toThrow()
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      readDir.mockRestore()
    })

    it("mounts even when the leftovers sweep cannot read the parent directory", async () => {
      const exists = jest.spyOn(RNFS, "exists").mockRejectedValue(new Error("EIO"))

      expect(() => render(<SelfCustodialTelemetryMount />)).not.toThrow()
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      exists.mockRestore()
    })

    it("mounts even when the pending-discard check fails", async () => {
      const unlink = jest.spyOn(RNFS, "unlink").mockRejectedValue(new Error("EBUSY"))
      await RNFS.writeFile(`${DIR}.discard`, "1", "utf8")

      expect(() => render(<SelfCustodialTelemetryMount />)).not.toThrow()
      await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))

      unlink.mockRestore()
    })
  })

  it("ignores an app-state change that is not a return to the foreground", async () => {
    const submit = ackingTransport()
    render(<SelfCustodialTelemetryMount />)
    await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))
    await createOutboxStore(DIR).enqueue(queuedRecord())
    resetDrainStateForTesting()
    submit.mockClear()

    const handlers = (AppState.addEventListener as jest.Mock).mock.calls
      .filter(([type]) => type === "change")
      .map(([, handler]) => handler as (state: string) => void)
    act(() => {
      for (const handler of handlers) handler("background")
    })

    expect(submit).not.toHaveBeenCalled()
  })

  describe("the transport the port stands on", () => {
    it("registers the relay for the network it is running on", async () => {
      render(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryTransport()?.name).toBe("blink-relay"))
      expect(mockCreateRelay).toHaveBeenCalledWith("https://staging.blink.sv")
    })

    it("registers a fresh adapter when the network changes, so nothing reports to the other network's relay", async () => {
      const { rerender } = render(<SelfCustodialTelemetryMount />)
      await waitFor(() => expect(getTelemetryTransport()?.name).toBe("blink-relay"))
      const onRegtest = getTelemetryTransport()

      mockNetwork = Network.Mainnet
      rerender(<SelfCustodialTelemetryMount />)

      await waitFor(() => expect(getTelemetryTransport()).not.toBe(onRegtest))
      expect(mockCreateRelay).toHaveBeenLastCalledWith("https://blink.sv")
    })
  })
})
