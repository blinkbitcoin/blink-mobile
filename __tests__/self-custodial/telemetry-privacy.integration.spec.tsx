/* eslint-disable camelcase */
/**
 * The privacy boundary end to end: the real TelemetryContextMount drives the real identity
 * owner and measurement gate, with only Firebase, storage and the active-account state
 * stubbed. What these pin is ordering — no self-custodial event reaches GA4 before the
 * Enhanced identity is fully in place, no custodial-era event before the custodial one is,
 * and no outcome crosses from the context it began in to the one that followed.
 */
import { it } from "@jest/globals"
import type * as ReactNamespace from "react"
import type * as Rntl from "@testing-library/react-native/pure"

import type * as Components from "@app/self-custodial/components/telemetry-context-mount"
import type * as Identity from "@app/self-custodial/analytics-identity"
import type * as Measurement from "@app/self-custodial/measurement"
import type * as LegacyAnalytics from "@app/utils/analytics"
import type { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountMode } from "@app/types/account"

const resolved = (..._args: unknown[]): Promise<void> => Promise.resolve()
const mockSetUserId = jest.fn(resolved)
const mockSetUserProperty = jest.fn(resolved)
const mockSetUserProperties = jest.fn(resolved)
const mockSetAnalyticsCollectionEnabled = jest.fn(resolved)
const mockResetAnalyticsData = jest.fn(resolved)
const mockLogEvent = jest.fn(resolved)

jest.mock("@react-native-firebase/analytics", () => () => ({
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperty: (...args: unknown[]) => mockSetUserProperty(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
  setAnalyticsCollectionEnabled: (...args: unknown[]) =>
    mockSetAnalyticsCollectionEnabled(...args),
  resetAnalyticsData: (...args: unknown[]) => mockResetAnalyticsData(...args),
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
  log: jest.fn(),
  isCrashlyticsCollectionEnabled: true,
  setCrashlyticsCollectionEnabled: () => Promise.resolve(null),
  deleteUnsentReports: () => Promise.resolve(),
}))

const mockStore = new Map<string, string>()
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore.set(key, value)
    return Promise.resolve()
  }),
}))

jest.mock("@app/self-custodial/telemetry-instance-id", () => ({
  getTelemetryInstanceId: () => Promise.resolve("install-uuid"),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => 0,
}))

const baseState: PersistentState = {
  schemaVersion: 21,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
  activeAccountId: "custodial-default",
}

let mockPersistentState: PersistentState = baseState
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    persistentState: mockPersistentState,
    updateState: jest.fn(),
  }),
}))

const activate = (accountId: string | null, mode: AccountMode | null) => {
  mockPersistentState = accountId
    ? {
        ...baseState,
        activeAccountId: accountId,
        selfCustodialAccountModeByAccountId: mode ? { [accountId]: mode } : {},
      }
    : baseState
}

/** A fresh process per test: the modules hold session state, and React, the renderer and
 *  the component must come from one registry. */
const boot = () => {
  let loaded:
    | {
        React: typeof ReactNamespace
        rntl: typeof Rntl
        mount: typeof Components
        identity: typeof Identity
        measurement: typeof Measurement
        legacy: typeof LegacyAnalytics
      }
    | undefined
  jest.isolateModules(() => {
    loaded = {
      React: jest.requireActual("react"),
      /** `pure`: the default entry registers cleanup hooks, which cannot be added mid-test. */
      rntl: jest.requireActual("@testing-library/react-native/pure"),
      mount: jest.requireActual("@app/self-custodial/components/telemetry-context-mount"),
      identity: jest.requireActual("@app/self-custodial/analytics-identity"),
      measurement: jest.requireActual("@app/self-custodial/measurement"),
      legacy: jest.requireActual("@app/utils/analytics"),
    }
  })
  if (!loaded) throw new Error("modules did not load")
  const { React, rntl, mount } = loaded
  const view = rntl.render(React.createElement(mount.TelemetryContextMount))
  const rerender = () => view.rerender(React.createElement(mount.TelemetryContextMount))
  return { ...loaded, rerender }
}

const settle = async () => {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  }
}

const deferred = () => {
  let release: () => void = () => undefined
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release: () => release() }
}

const firstCall = (mock: jest.Mock, matcher: (args: unknown[]) => boolean): number => {
  const index = mock.mock.calls.findIndex(matcher)
  if (index < 0) throw new Error("call not found")
  return mock.mock.invocationCallOrder[index]
}

const COMPLETED = 0
const PENDING = 1
const SEND = 0

describe("self-custodial telemetry privacy boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.clear()
    activate(null, null)
    ;[
      mockSetUserId,
      mockSetUserProperty,
      mockSetUserProperties,
      mockSetAnalyticsCollectionEnabled,
      mockResetAnalyticsData,
    ].forEach((mock) => mock.mockImplementation(resolved))
  })

  describe("onboarding events and the identity they go out under", () => {
    it("holds a signed-in custodial user's wallet creation until the reset and the per-install id", async () => {
      const { identity, measurement, rerender } = boot()
      identity.setCustodialIdentity({
        userId: "me-1",
        hasUsername: true,
        accountLevel: "TWO",
      })
      await settle()
      expect(mockSetUserId).toHaveBeenCalledWith("me-1")
      const heldReset = deferred()
      mockResetAnalyticsData.mockImplementation(() => heldReset.promise)

      /** The creation is measured against the mode just chosen, before activation. */
      measurement.measureFor(
        { accountId: "sc-1", mode: AccountMode.Enhanced },
        measurement.ScEvent.AccountCreated,
        { flow: "create" },
      )
      await settle()
      expect(mockLogEvent).not.toHaveBeenCalled()

      activate("sc-1", AccountMode.Enhanced)
      rerender()
      await settle()
      expect(mockLogEvent).not.toHaveBeenCalled()

      heldReset.release()
      await settle()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledWith("sc_account_created", {
        network: "mainnet",
        flow: "create",
      })
      const logged = mockLogEvent.mock.invocationCallOrder[0]
      expect(logged).toBeGreaterThan(mockResetAnalyticsData.mock.invocationCallOrder[0])
      expect(logged).toBeGreaterThan(
        firstCall(mockSetUserId, ([id]) => id === "install-uuid"),
      )
    })

    it("delivers an Incognito → Enhanced switch once, after collection is back on", async () => {
      activate("sc-1", AccountMode.Anon)
      const { measurement, rerender } = boot()
      await settle()
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false)

      /** As the switch surfaces do: measured, then the mode is written. */
      measurement.measureFor(
        { accountId: "sc-1", mode: AccountMode.Enhanced },
        measurement.ScEvent.AccountModeChanged,
        { from: AccountMode.Anon, to: AccountMode.Enhanced },
      )
      activate("sc-1", AccountMode.Enhanced)
      rerender()
      await settle()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledWith(
        "sc_account_mode_changed",
        expect.objectContaining({ to: AccountMode.Enhanced }),
      )
      expect(mockLogEvent.mock.invocationCallOrder[0]).toBeGreaterThan(
        firstCall(mockSetAnalyticsCollectionEnabled, ([on]) => on === true),
      )
    })

    it("sends nothing when the transition to Enhanced is rejected", async () => {
      const { identity, measurement, rerender } = boot()
      identity.setCustodialIdentity({
        userId: "me-1",
        hasUsername: true,
        accountLevel: "TWO",
      })
      await settle()
      mockResetAnalyticsData.mockImplementation(() =>
        Promise.reject(new Error("native reset failed")),
      )

      activate("sc-1", AccountMode.Enhanced)
      rerender()
      measurement.measure(measurement.ScEvent.LightningAddressRegistered)
      await settle()

      expect(mockLogEvent).not.toHaveBeenCalled()
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false)
    })

    it("does not carry an event from a failed transition onto the next account's identity", async () => {
      const { identity, measurement, rerender } = boot()
      identity.setCustodialIdentity({
        userId: "me-1",
        hasUsername: true,
        accountLevel: "TWO",
      })
      await settle()
      mockResetAnalyticsData.mockImplementationOnce(() =>
        Promise.reject(new Error("native reset failed")),
      )

      activate("sc-a", AccountMode.Enhanced)
      rerender()
      measurement.measure(measurement.ScEvent.LightningAddressRegistered)
      await settle()

      activate("sc-b", AccountMode.Enhanced)
      rerender()
      /** sc-b's transition is retried by the custodial identity arriving again. */
      identity.setCustodialIdentity({
        userId: "me-1",
        hasUsername: true,
        accountLevel: "TWO",
      })
      await settle()
      expect(identity.isEnhancedIdentityApplied()).toBe(true)

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("does not carry an event held for one account through custodial onto another", async () => {
      activate("sc-a", AccountMode.Enhanced)
      const { measurement, rerender } = boot()
      await settle()
      const heldId = deferred()
      mockSetUserId.mockImplementation((...args: unknown[]) =>
        args[0] === "install-uuid" ? heldId.promise : Promise.resolve(),
      )

      activate(null, null)
      rerender()
      activate("sc-a", AccountMode.Enhanced)
      rerender()
      measurement.measure(measurement.ScEvent.LightningAddressRegistered)
      activate(null, null)
      rerender()
      activate("sc-b", AccountMode.Enhanced)
      rerender()
      mockSetUserId.mockImplementation(resolved)
      heldId.release()
      await settle()

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("delivers an Enhanced account's events at once after a switch from another Enhanced account", async () => {
      activate("sc-a", AccountMode.Enhanced)
      const { measurement, rerender } = boot()
      await settle()

      activate("sc-b", AccountMode.Enhanced)
      rerender()
      measurement.measure(measurement.ScEvent.LightningAddressRegistered)
      await settle()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
    })
  })

  /** The custodial-era events in `utils/analytics` follow the custodial identity the way
   *  sc_* events follow the Enhanced one: requested is not enough, applied is. */
  describe("custodial-era events and the identity they go out under", () => {
    const CUSTODIAL = { userId: "me-1", hasUsername: true, accountLevel: "TWO" }
    const PAYMENT_ATTEMPT = { paymentType: "lightning", sendingWallet: "BTC" } as const
    const loggedNamed = (name: string) =>
      mockLogEvent.mock.calls.filter(([logged]) => logged === name)

    it("holds a payment attempt made while switching back from Enhanced until the separation and the custodial id", async () => {
      activate("sc-1", AccountMode.Enhanced)
      const { identity, legacy, rerender } = boot()
      identity.setCustodialIdentity(CUSTODIAL)
      await settle()
      expect(identity.isEnhancedIdentityApplied()).toBe(true)
      const heldReset = deferred()
      mockResetAnalyticsData.mockImplementation(() => heldReset.promise)

      activate(null, null)
      rerender()
      await settle()
      legacy.logPaymentAttempt(PAYMENT_ATTEMPT as never)
      await settle()
      /** Sent now, it would land on the Enhanced app instance under the per-install id. */
      expect(loggedNamed("payment_attempt")).toHaveLength(0)

      heldReset.release()
      await settle()

      expect(loggedNamed("payment_attempt")).toHaveLength(1)
      const logged = firstCall(mockLogEvent, ([name]) => name === "payment_attempt")
      expect(logged).toBeGreaterThan(
        mockResetAnalyticsData.mock.invocationCallOrder[
          mockResetAnalyticsData.mock.calls.length - 1
        ],
      )
      expect(logged).toBeGreaterThan(firstCall(mockSetUserId, ([id]) => id === "me-1"))
      expect(logged).toBeGreaterThan(
        mockSetAnalyticsCollectionEnabled.mock.invocationCallOrder[
          mockSetAnalyticsCollectionEnabled.mock.calls.length - 1
        ],
      )
    })

    it("holds a destination parse made while leaving Incognito until collection is back on", async () => {
      activate("sc-1", AccountMode.Anon)
      const { identity, legacy, rerender } = boot()
      identity.setCustodialIdentity(CUSTODIAL)
      await settle()
      const heldCollection = deferred()
      mockSetAnalyticsCollectionEnabled.mockImplementation((...args: unknown[]) =>
        args[0] === true ? heldCollection.promise : Promise.resolve(),
      )

      activate(null, null)
      rerender()
      await settle()
      legacy.logParseDestinationResult({
        valid: true,
        validDestination: { paymentType: "lightning" },
        destinationDirection: "Send",
      } as never)
      await settle()
      /** Sent now, collection that is still off would drop it. */
      expect(loggedNamed("payment_destination_accepted")).toHaveLength(0)

      heldCollection.release()
      await settle()

      expect(loggedNamed("payment_destination_accepted")).toHaveLength(1)
      expect(
        firstCall(mockLogEvent, ([name]) => name === "payment_destination_accepted"),
      ).toBeGreaterThan(
        firstCall(mockSetAnalyticsCollectionEnabled, ([enabled]) => enabled === true),
      )
    })

    it("drops what it held when the switch to custodial is overtaken by Incognito", async () => {
      activate("sc-1", AccountMode.Enhanced)
      const { identity, legacy, rerender } = boot()
      identity.setCustodialIdentity(CUSTODIAL)
      await settle()
      const heldReset = deferred()
      mockResetAnalyticsData.mockImplementation(() => heldReset.promise)

      activate(null, null)
      rerender()
      await settle()
      legacy.logPaymentAttempt(PAYMENT_ATTEMPT as never)
      activate("sc-1", AccountMode.Anon)
      rerender()
      heldReset.release()
      await settle()

      expect(loggedNamed("payment_attempt")).toHaveLength(0)
    })

    it("sends at once while the custodial identity is in place", async () => {
      const { identity, legacy } = boot()
      identity.setCustodialIdentity(CUSTODIAL)
      await settle()

      legacy.logPaymentAttempt(PAYMENT_ATTEMPT as never)

      expect(loggedNamed("payment_attempt")).toHaveLength(1)
    })
  })

  describe("payment outcomes and the context they began in", () => {
    const settlement = {
      settled: [{ event: "sc_payment_send_settled" as const }],
      failed: { event: "sc_payment_send_failed" as const },
    }
    const completedSend = { id: "pay-1", status: COMPLETED, paymentType: SEND, method: 0 }

    it.each([
      ["Incognito", AccountMode.Anon],
      ["an unset mode", null],
    ])(
      "never reports a send begun under %s after a switch to Enhanced",
      async (_label, startMode) => {
        activate("sc-1", startMode)
        const { measurement, rerender } = boot()
        await settle()
        const startedIn = measurement.measurementGeneration()

        measurement.measureSettlement(
          { id: "pay-1", status: PENDING },
          settlement,
          startedIn,
        )
        activate("sc-1", AccountMode.Enhanced)
        rerender()
        await settle()
        measurement.measureObservedPayment(completedSend as never)
        await settle()

        expect(mockLogEvent).not.toHaveBeenCalled()
      },
    )

    it("never reports a send that returns after its Incognito switch", async () => {
      activate("sc-1", AccountMode.Anon)
      const { measurement, rerender } = boot()
      await settle()
      const startedIn = measurement.measurementGeneration()

      activate("sc-1", AccountMode.Enhanced)
      rerender()
      await settle()
      measurement.measureSettlement(
        { id: "pay-1", status: COMPLETED },
        settlement,
        startedIn,
      )
      await settle()

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("does not carry a pending send from one Enhanced account to the next", async () => {
      activate("sc-a", AccountMode.Enhanced)
      const { measurement, rerender } = boot()
      await settle()

      measurement.measureSettlement(
        { id: "pay-1", status: PENDING },
        settlement,
        measurement.measurementGeneration(),
      )
      activate("sc-b", AccountMode.Enhanced)
      rerender()
      await settle()
      measurement.measureObservedPayment(completedSend as never)
      await settle()

      expect(mockLogEvent).not.toHaveBeenCalled()
    })

    it("reports a pending send that settles in the context it began in", async () => {
      activate("sc-a", AccountMode.Enhanced)
      const { measurement } = boot()
      await settle()

      measurement.measureSettlement(
        { id: "pay-1", status: PENDING },
        settlement,
        measurement.measurementGeneration(),
      )
      measurement.measureObservedPayment(completedSend as never)
      await settle()

      expect(mockLogEvent).toHaveBeenCalledTimes(1)
      expect(mockLogEvent).toHaveBeenCalledWith(
        "sc_payment_send_settled",
        expect.anything(),
      )
    })
  })
})
