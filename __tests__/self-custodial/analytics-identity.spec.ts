import { it } from "@jest/globals"

import type * as AnalyticsIdentity from "@app/self-custodial/analytics-identity"

/** Firebase's setters are asynchronous; each mock answers with a promise, and a test can
 *  hold one back to see what the module does while it is outstanding. */
const resolved = (..._args: unknown[]): Promise<void> => Promise.resolve()
const mockSetUserId = jest.fn(resolved)
const mockSetUserProperty = jest.fn(resolved)
const mockSetUserProperties = jest.fn(resolved)
const mockSetAnalyticsCollectionEnabled = jest.fn(resolved)
const mockResetAnalyticsData = jest.fn(resolved)
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/analytics", () => () => ({
  setUserId: (...args: unknown[]) => mockSetUserId(...args),
  setUserProperty: (...args: unknown[]) => mockSetUserProperty(...args),
  setUserProperties: (...args: unknown[]) => mockSetUserProperties(...args),
  setAnalyticsCollectionEnabled: (...args: unknown[]) =>
    mockSetAnalyticsCollectionEnabled(...args),
  resetAnalyticsData: (...args: unknown[]) => mockResetAnalyticsData(...args),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
}))

const mockStore = new Map<string, string>()
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStore.set(key, value)
    return Promise.resolve()
  }),
}))

let mockInstanceId: () => Promise<string> = () => Promise.resolve("install-uuid")
jest.mock("@app/self-custodial/telemetry-instance-id", () => ({
  getTelemetryInstanceId: () => mockInstanceId(),
}))

const SIDE_KEY = "analyticsIdentitySide"
const CUSTODIAL = { userId: "me-1", hasUsername: true, accountLevel: "TWO" }

/** The module keeps its state across calls, as it does across a session; each test
 *  starts a fresh process. */
const freshModule = (): typeof AnalyticsIdentity => {
  let mod: typeof AnalyticsIdentity | undefined
  jest.isolateModules(() => {
    mod = jest.requireActual<typeof AnalyticsIdentity>(
      "@app/self-custodial/analytics-identity",
    )
  })
  if (!mod) throw new Error("module did not load")
  return mod
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

const orderOf = (mock: jest.Mock, matcher: (args: unknown[]) => boolean): number => {
  const index = mock.mock.calls.findIndex(matcher)
  if (index < 0) throw new Error("call not found")
  return mock.mock.invocationCallOrder[index]
}

const userIdSetTo = (value: unknown) => (args: unknown[]) => args[0] === value
const collectionSetTo = (value: boolean) => (args: unknown[]) => args[0] === value

describe("analytics identity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.clear()
    mockInstanceId = () => Promise.resolve("install-uuid")
    ;[
      mockSetUserId,
      mockSetUserProperty,
      mockSetUserProperties,
      mockSetAnalyticsCollectionEnabled,
      mockResetAnalyticsData,
    ].forEach((mock) => mock.mockImplementation(resolved))
  })

  describe("identity transitions", () => {
    it("attaches the custodial identity on a custodial start without resetting", async () => {
      const id = freshModule()

      id.setCustodialIdentity(CUSTODIAL)
      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)
      await settle()

      expect(mockResetAnalyticsData).not.toHaveBeenCalled()
      expect(mockSetUserId).toHaveBeenCalledWith("me-1")
      expect(mockSetUserProperty).toHaveBeenCalledWith("hasUsername", "true")
      expect(mockSetUserProperty).toHaveBeenCalledWith("accountLevel", "TWO")
      expect(mockSetUserProperty).toHaveBeenCalledWith("account_mode", "custodial")
      expect(mockStore.get(SIDE_KEY)).toBe("custodial")
    })

    it("separates custodial from Enhanced before the per-install id is attached", async () => {
      const id = freshModule()
      id.setSharedUserProperties({ galoyInstance: "Main" })
      id.setCustodialIdentity(CUSTODIAL)
      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)
      await settle()
      jest.clearAllMocks()

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()

      const detached = orderOf(mockSetUserId, userIdSetTo(null))
      const cleared = orderOf(
        mockSetUserProperties,
        ([props]) =>
          (props as Record<string, unknown>).accountLevel === null &&
          (props as Record<string, unknown>).hasUsername === null,
      )
      const reset = mockResetAnalyticsData.mock.invocationCallOrder[0]
      const restored = orderOf(
        mockSetUserProperties,
        ([props]) => (props as Record<string, unknown>).galoyInstance === "Main",
      )
      const attached = orderOf(mockSetUserId, userIdSetTo("install-uuid"))
      const enabled = orderOf(mockSetAnalyticsCollectionEnabled, collectionSetTo(true))

      expect(detached).toBeLessThan(reset)
      expect(cleared).toBeLessThan(reset)
      expect(reset).toBeLessThan(restored)
      expect(reset).toBeLessThan(attached)
      expect(attached).toBeLessThan(enabled)
      expect(mockSetUserId).not.toHaveBeenCalledWith("me-1")
      expect(mockStore.get(SIDE_KEY)).toBe("self_custodial")
    })

    it("separates again on the way back, then re-attaches the custodial id", async () => {
      const id = freshModule()
      id.setCustodialIdentity(CUSTODIAL)
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      jest.clearAllMocks()

      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)
      await settle()

      const reset = mockResetAnalyticsData.mock.invocationCallOrder[0]
      expect(reset).toBeLessThan(orderOf(mockSetUserId, userIdSetTo("me-1")))
    })

    it("holds a custodial identity that arrives while a self-custodial account is active", async () => {
      const id = freshModule()
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      jest.clearAllMocks()

      id.setCustodialIdentity(CUSTODIAL)
      await settle()

      expect(mockSetUserId).not.toHaveBeenCalledWith("me-1")
      expect(mockSetUserProperty).not.toHaveBeenCalledWith("accountLevel", "TWO")
    })

    it("does not reset between Enhanced and Incognito, which are the same side", async () => {
      const id = freshModule()
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      jest.clearAllMocks()

      id.setAnalyticsDomain(id.AnalyticsDomain.Anon)
      await settle()

      expect(mockResetAnalyticsData).not.toHaveBeenCalled()
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false)
    })

    it.each([
      ["the last run ended custodial", "custodial", 1],
      ["there is no record of the last run", undefined, 1],
      ["the last run was already self-custodial", "self_custodial", 0],
    ])(
      "resets as needed on a self-custodial cold start where %s",
      async (_label, stored, resets) => {
        if (stored) mockStore.set(SIDE_KEY, stored)
        const id = freshModule()

        id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
        await settle()

        expect(mockResetAnalyticsData).toHaveBeenCalledTimes(resets)
        expect(mockSetUserId).toHaveBeenLastCalledWith("install-uuid")
      },
    )

    it("does not reset a custodial cold start whose last run ended custodial", async () => {
      mockStore.set(SIDE_KEY, "custodial")
      const id = freshModule()

      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)
      await settle()

      expect(mockResetAnalyticsData).not.toHaveBeenCalled()
    })
  })

  describe("closed domains", () => {
    it.each([
      ["Incognito", "anon"],
      ["an unset mode", "unset"],
    ] as const)(
      "shuts collection for %s at once, detaching identity first",
      (_label, domain) => {
        const id = freshModule()

        id.setAnalyticsDomain(domain)

        const detached = orderOf(mockSetUserId, userIdSetTo(null))
        const disabled = orderOf(
          mockSetAnalyticsCollectionEnabled,
          collectionSetTo(false),
        )
        expect(detached).toBeLessThan(disabled)
      },
    )

    it("clears the Enhanced label when an unset account follows an Enhanced one", async () => {
      mockStore.set(SIDE_KEY, "self_custodial")
      const id = freshModule()
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      jest.clearAllMocks()

      id.setAnalyticsDomain(id.AnalyticsDomain.Unset)
      await settle()

      expect(mockSetUserProperty).toHaveBeenCalledWith("account_mode", null)
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false)
      expect(mockSetAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true)
    })

    it("never lets a slow Enhanced id land after a switch to Incognito", async () => {
      let releaseId: (value: string) => void = () => undefined
      mockInstanceId = () =>
        new Promise((resolve) => {
          releaseId = resolve
        })
      mockStore.set(SIDE_KEY, "self_custodial")
      const id = freshModule()

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      id.setAnalyticsDomain(id.AnalyticsDomain.Anon)
      releaseId("install-uuid")
      await settle()

      expect(mockSetUserId).not.toHaveBeenCalledWith("install-uuid")
      expect(mockSetAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true)
    })

    it("never re-enables collection from a transition step still in flight", async () => {
      mockStore.set(SIDE_KEY, "self_custodial")
      const heldId = deferred()
      mockSetUserId.mockImplementation((...args: unknown[]) =>
        args[0] === "install-uuid" ? heldId.promise : Promise.resolve(),
      )
      const id = freshModule()

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      id.setAnalyticsDomain(id.AnalyticsDomain.Anon)
      heldId.release()
      await settle()

      expect(mockSetAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true)
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false)
    })

    it("fails closed when the per-install id cannot be read", async () => {
      mockInstanceId = () => Promise.reject(new Error("storage down"))
      mockStore.set(SIDE_KEY, "self_custodial")
      const id = freshModule()

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()

      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false)
      expect(mockSetAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true)
      expect(mockRecordError).toHaveBeenCalled()
    })
  })

  describe("the Enhanced-applied signal", () => {
    const listen = (id: typeof AnalyticsIdentity) => {
      const listener = jest.fn()
      id.onEnhancedIdentityApplied(listener)
      return listener
    }

    it("is given once the reset, the per-install id and collection are all in place", async () => {
      const id = freshModule()
      id.setCustodialIdentity(CUSTODIAL)
      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)
      await settle()
      const heldReset = deferred()
      mockResetAnalyticsData.mockImplementation(() => heldReset.promise)
      const listener = listen(id)

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      expect(id.isEnhancedIdentityApplied()).toBe(false)
      expect(listener).not.toHaveBeenCalled()

      heldReset.release()
      await settle()

      expect(id.isEnhancedIdentityApplied()).toBe(true)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener.mock.invocationCallOrder[0]).toBeGreaterThan(
        orderOf(mockSetUserId, userIdSetTo("install-uuid")),
      )
      expect(listener.mock.invocationCallOrder[0]).toBeGreaterThan(
        orderOf(mockSetAnalyticsCollectionEnabled, collectionSetTo(true)),
      )
    })

    it("is withdrawn the moment another domain is requested", async () => {
      mockStore.set(SIDE_KEY, "self_custodial")
      const id = freshModule()
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      expect(id.isEnhancedIdentityApplied()).toBe(true)

      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)

      expect(id.isEnhancedIdentityApplied()).toBe(false)
    })

    it("is not given when a step of the transition is rejected", async () => {
      const id = freshModule()
      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)
      await settle()
      mockResetAnalyticsData.mockImplementation(() =>
        Promise.reject(new Error("native reset failed")),
      )
      const listener = listen(id)

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()

      expect(listener).not.toHaveBeenCalled()
      expect(id.isEnhancedIdentityApplied()).toBe(false)
      expect(mockSetUserId).not.toHaveBeenCalledWith("install-uuid")
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(false)
      expect(mockRecordError).toHaveBeenCalled()
    })

    it("is not given for a superseded transition, only for the one that replaced it", async () => {
      mockStore.set(SIDE_KEY, "self_custodial")
      const heldId = deferred()
      mockSetUserId.mockImplementation((...args: unknown[]) =>
        args[0] === "install-uuid" ? heldId.promise : Promise.resolve(),
      )
      const id = freshModule()
      const listener = listen(id)

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      /** Away and straight back while the first run waits on a step: the same domain,
       *  but a newer request. */
      id.setAnalyticsDomain(id.AnalyticsDomain.Anon)
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      mockSetUserId.mockImplementation(resolved)
      heldId.release()
      await settle()

      expect(listener).toHaveBeenCalledTimes(1)
      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(true)
    })
  })

  describe("shutdowns and later transitions", () => {
    it("lets a held Incognito shutdown finish before Enhanced is applied again", async () => {
      mockStore.set(SIDE_KEY, "self_custodial")
      const id = freshModule()
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      const heldShutdown = deferred()
      mockSetAnalyticsCollectionEnabled.mockImplementation((...args: unknown[]) =>
        args[0] === false ? heldShutdown.promise : Promise.resolve(),
      )
      jest.clearAllMocks()

      id.setAnalyticsDomain(id.AnalyticsDomain.Anon)
      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      expect(mockSetAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true)
      expect(id.isEnhancedIdentityApplied()).toBe(false)

      heldShutdown.release()
      await settle()

      expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(true)
      expect(mockSetUserId).toHaveBeenLastCalledWith("install-uuid")
      expect(id.isEnhancedIdentityApplied()).toBe(true)
    })

    it("lets a failed transition's cleanup finish before a retry begins", async () => {
      const id = freshModule()
      id.setAnalyticsDomain(id.AnalyticsDomain.Custodial)
      await settle()
      mockResetAnalyticsData.mockImplementationOnce(() =>
        Promise.reject(new Error("native reset failed")),
      )
      const heldCleanup = deferred()
      mockSetAnalyticsCollectionEnabled.mockImplementation((...args: unknown[]) =>
        args[0] === false ? heldCleanup.promise : Promise.resolve(),
      )
      jest.clearAllMocks()

      id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
      await settle()
      /** A retry arrives while the failed run's cleanup is still outstanding. */
      id.setCustodialIdentity(CUSTODIAL)
      await settle()
      expect(mockSetAnalyticsCollectionEnabled).not.toHaveBeenCalledWith(true)

      heldCleanup.release()
      await settle()

      const cleanedUp = orderOf(mockSetAnalyticsCollectionEnabled, collectionSetTo(false))
      const reopened = orderOf(mockSetAnalyticsCollectionEnabled, collectionSetTo(true))
      expect(cleanedUp).toBeLessThan(reopened)
      expect(id.isEnhancedIdentityApplied()).toBe(true)
    })
  })
})
