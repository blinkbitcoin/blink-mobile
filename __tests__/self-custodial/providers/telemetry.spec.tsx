import React from "react"
import { AppState } from "react-native"

import { act, render, waitFor } from "@testing-library/react-native"
import { Network } from "@breeztech/breez-sdk-spark-react-native"
import RNFS from "react-native-fs"

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
} from "@app/telemetry/transport"
import { AccountMode } from "@app/types/account"
import { AccountType, ActiveWalletStatus } from "@app/types/wallet"

const ACCOUNT_ID = "self-custodial-1"
const OTHER_ACCOUNT_ID = "self-custodial-2"

let mockActiveAccount: { id: string; type: AccountType } | undefined
let mockSelfCustodialEntries: { id: string }[]
let mockAccountMode: AccountMode | null
let mockServerModes: Record<string, AccountMode>
let mockRemoteConfigTrusted: boolean
let mockTelemetryEnabled: boolean
let mockKillSwitchEngaged: boolean | undefined
let mockConnectedAccountId: string | null
let mockWalletStatus: ActiveWalletStatus
const mockUpdateState = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount,
    selfCustodialEntries: mockSelfCustodialEntries,
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
    },
    updateState: mockUpdateState,
  }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({
    remoteConfigTrusted: mockRemoteConfigTrusted,
    telemetryEnabled: mockTelemetryEnabled,
  }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({
    connectedAccountId: mockConnectedAccountId,
    status: mockWalletStatus,
  }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
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

const ackingTransport = () => {
  const submit = jest.fn<Promise<SubmitResult>, [ContractPayload]>(() =>
    Promise.resolve({ kind: "acknowledged", ackedAt: 1 }),
  )
  registerTelemetryTransport({
    name: "test",
    ackSemantics: "application",
    attachesNoImplicitIdentity: true,
    submit,
  })
  return submit
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
    mockAccountMode = AccountMode.Enhanced
    mockServerModes = {}
    mockRemoteConfigTrusted = true
    mockTelemetryEnabled = true
    mockKillSwitchEngaged = undefined
    mockConnectedAccountId = ACCOUNT_ID
    mockWalletStatus = ActiveWalletStatus.Ready
  })

  afterEach(() => {
    setActiveOutbox(null)
  })

  describe("AD-25 — three inputs, deny wins", () => {
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

  describe("FR-5 / AD-26 — discard on activation, and finish what the last run started", () => {
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

    it("re-runs a discard the last run left a marker for, even under Enhanced", async () => {
      const store = createOutboxStore(DIR)
      await store.enqueue(queuedRecord())
      await RNFS.writeFile(`${DIR}/.discard`, "1", "utf8")

      render(<SelfCustodialTelemetryMount />)

      await waitFor(async () => expect(await store.hasPendingDiscard()).toBe(false))
      expect(await store.pending()).toEqual([])
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

  describe("AD-26 — the drain's triggers are SDK connect, emission and foreground", () => {
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

  describe("AD-28 — the kill switch reaches an account that settled its mode long ago", () => {
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
  })

  describe("FR-25 — every account's queue expires, active or not", () => {
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

  describe("AD-28 / AD-30 — the switches", () => {
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
})
