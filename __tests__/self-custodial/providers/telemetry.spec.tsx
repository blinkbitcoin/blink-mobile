import React from "react"

import { render, waitFor } from "@testing-library/react-native"
import { Network } from "@breeztech/breez-sdk-spark-react-native"
import RNFS from "react-native-fs"

import { telemetryOutboxDirFor } from "@app/self-custodial/config"
import { SelfCustodialTelemetryMount } from "@app/self-custodial/providers/telemetry"
import {
  RailType,
  TelemetryDirection,
  TelemetryEvent,
  WalletProvider,
} from "@app/telemetry/contract"
import { resetDiagnosticsForTesting } from "@app/telemetry/diagnostics"
import {
  getTelemetryMode,
  resetTelemetryModeForTesting,
  TelemetryMode,
} from "@app/telemetry/mode"
import { OutboxState } from "@app/telemetry/outbox/record"
import {
  createOutboxStore,
  resetOutboxCountersForTesting,
} from "@app/telemetry/outbox/store"
import {
  registerTelemetryTransport,
  resetTelemetryTransportForTesting,
  type TransportResult,
} from "@app/telemetry/transport"
import { AccountMode } from "@app/types/account"
import { AccountType } from "@app/types/wallet"

const ACCOUNT_ID = "self-custodial-1"
const OTHER_ACCOUNT_ID = "self-custodial-2"

let mockActiveAccount: { id: string; type: AccountType } | undefined
let mockSelfCustodialEntries: { id: string }[]
let mockAccountMode: AccountMode | null
let mockRemoteConfigTrusted: boolean

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount,
    selfCustodialEntries: mockSelfCustodialEntries,
  }),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ accountMode: mockAccountMode }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({ remoteConfigTrusted: mockRemoteConfigTrusted }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "regtest",
}))

const mockFs = RNFS as unknown as { __resetMockFileSystem: () => void }

const DIR = telemetryOutboxDirFor(ACCOUNT_ID, "regtest" as unknown as Network)
const OTHER_DIR = telemetryOutboxDirFor(OTHER_ACCOUNT_ID, "regtest" as unknown as Network)

const queuedRecord = (id = "3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e7f8") => ({
  telemetryEventId: id,
  event: TelemetryEvent.PaymentSettled,
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

describe("SelfCustodialTelemetryMount", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFs.__resetMockFileSystem()
    resetTelemetryModeForTesting()
    resetTelemetryTransportForTesting()
    resetOutboxCountersForTesting()
    resetDiagnosticsForTesting()

    mockActiveAccount = { id: ACCOUNT_ID, type: AccountType.SelfCustodial }
    mockSelfCustodialEntries = [{ id: ACCOUNT_ID }]
    mockAccountMode = AccountMode.Enhanced
    mockRemoteConfigTrusted = true
  })

  it("resolves the mode of whichever account is active", async () => {
    render(<SelfCustodialTelemetryMount />)

    await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Enhanced))
  })

  it("resolves an unset mode as Unresolved, not Enhanced", async () => {
    mockAccountMode = null

    render(<SelfCustodialTelemetryMount />)

    await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved))
  })

  it("discards a queue left by an account that switched to incognito while inactive", async () => {
    // The FR-5 back door: queue under Enhanced, switch mode elsewhere, come back. If the
    // drain ran before the mode resolved, those events would flush on activation — which is
    // flush-then-discard with extra steps.
    await createOutboxStore(DIR).enqueue(queuedRecord())
    mockAccountMode = AccountMode.Anon

    const submit = jest.fn<Promise<TransportResult>, unknown[]>(() =>
      Promise.resolve({ outcome: "acknowledged" }),
    )
    registerTelemetryTransport({ name: "test", attachesPerEventIdentity: false, submit })

    render(<SelfCustodialTelemetryMount />)

    await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Anon))
    await waitFor(async () => expect(await createOutboxStore(DIR).pending()).toEqual([]))
    expect(submit).not.toHaveBeenCalled()
  })

  it("drains that same queue when the account is still Enhanced", async () => {
    // Anchor for the case above: the discard is the mode's doing, not a store that was
    // never mounted or a transport that was never registered.
    await createOutboxStore(DIR).enqueue(queuedRecord())

    const submit = jest.fn<Promise<TransportResult>, unknown[]>(() =>
      Promise.resolve({ outcome: "acknowledged" }),
    )
    registerTelemetryTransport({ name: "test", attachesPerEventIdentity: false, submit })

    render(<SelfCustodialTelemetryMount />)

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1))
  })

  it("touches only the active account's queue when two accounts hold records", async () => {
    // Mode is stored per account, so activating an incognito one must not reach across to
    // an Enhanced account's queue — and draining the Enhanced one must not flush the other.
    await createOutboxStore(DIR).enqueue(
      queuedRecord("3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e701"),
    )
    await createOutboxStore(OTHER_DIR).enqueue(
      queuedRecord("3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e702"),
    )

    mockActiveAccount = { id: OTHER_ACCOUNT_ID, type: AccountType.SelfCustodial }
    mockSelfCustodialEntries = [{ id: ACCOUNT_ID }, { id: OTHER_ACCOUNT_ID }]
    mockAccountMode = AccountMode.Anon

    render(<SelfCustodialTelemetryMount />)

    await waitFor(async () =>
      expect(await createOutboxStore(OTHER_DIR).pending()).toEqual([]),
    )
    // The account that was never activated keeps its queue: its own mode has not changed.
    expect(await createOutboxStore(DIR).pending()).toHaveLength(1)
  })

  it("keeps draining on a cadence, not only once on mount", async () => {
    jest.useFakeTimers()
    try {
      const submit = jest.fn<Promise<TransportResult>, unknown[]>(() =>
        Promise.resolve({ outcome: "acknowledged" }),
      )
      registerTelemetryTransport({
        name: "test",
        attachesPerEventIdentity: false,
        submit,
      })

      render(<SelfCustodialTelemetryMount />)
      await jest.advanceTimersByTimeAsync(0)
      const onMount = submit.mock.calls.length

      await createOutboxStore(DIR).enqueue(
        queuedRecord("3f2a1b4c-5d6e-4f70-8192-a3b4c5d6e703"),
      )
      await jest.advanceTimersByTimeAsync(5 * 60 * 1000)

      expect(submit.mock.calls.length).toBeGreaterThan(onMount)
    } finally {
      jest.useRealTimers()
    }
  })

  it("leaves the mode Unresolved while no self-custodial account is active", async () => {
    mockActiveAccount = { id: "custodial-default", type: AccountType.Custodial }
    mockRemoteConfigTrusted = false

    render(<SelfCustodialTelemetryMount />)

    await waitFor(() => expect(getTelemetryMode()).toBe(TelemetryMode.Unresolved))
  })
})
