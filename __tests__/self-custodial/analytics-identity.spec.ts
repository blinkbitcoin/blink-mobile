import { it } from "@jest/globals"

import type * as AnalyticsIdentity from "@app/self-custodial/analytics-identity"

const mockSetUserId = jest.fn()
const mockSetUserProperty = jest.fn()
const mockSetUserProperties = jest.fn()
const mockSetAnalyticsCollectionEnabled = jest.fn()
const mockResetAnalyticsData = jest.fn()
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
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
  }
}

const orderOf = (mock: jest.Mock, matcher: (args: unknown[]) => boolean): number => {
  const index = mock.mock.calls.findIndex(matcher)
  if (index < 0) throw new Error("call not found")
  return mock.mock.invocationCallOrder[index]
}

const userIdSetTo = (value: unknown) => (args: unknown[]) => args[0] === value

describe("analytics identity", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.clear()
    mockInstanceId = () => Promise.resolve("install-uuid")
  })

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

    expect(detached).toBeLessThan(reset)
    expect(cleared).toBeLessThan(reset)
    expect(reset).toBeLessThan(restored)
    expect(reset).toBeLessThan(attached)
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
    "on a self-custodial cold start where %s, resets %i time(s)",
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

  it("shuts collection for Incognito at once, detaching identity first", () => {
    const id = freshModule()

    id.setAnalyticsDomain(id.AnalyticsDomain.Anon)

    const detached = orderOf(mockSetUserId, userIdSetTo(null))
    const disabled = orderOf(mockSetAnalyticsCollectionEnabled, ([on]) => on === false)
    expect(detached).toBeLessThan(disabled)
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

  it("reports an Enhanced account without an id when the per-install id cannot be read", async () => {
    mockInstanceId = () => Promise.reject(new Error("storage down"))
    mockStore.set(SIDE_KEY, "self_custodial")
    const id = freshModule()

    id.setAnalyticsDomain(id.AnalyticsDomain.Enhanced)
    await settle()

    expect(mockSetUserId).toHaveBeenLastCalledWith(null)
    expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(true)
  })

  it("leaves an unset mode collecting with no identity", async () => {
    mockStore.set(SIDE_KEY, "self_custodial")
    const id = freshModule()

    id.setAnalyticsDomain(id.AnalyticsDomain.Unset)
    await settle()

    expect(mockSetAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(true)
    expect(mockSetUserId).toHaveBeenLastCalledWith(null)
  })
})
