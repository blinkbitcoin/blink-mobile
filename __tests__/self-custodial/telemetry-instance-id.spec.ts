import {
  getTelemetryInstanceId,
  resetTelemetryInstanceIdCache,
} from "@app/self-custodial/telemetry-instance-id"

const store = new Map<string, string>()

let uuidCounter = 0
jest.mock("react-native-quick-crypto", () => ({
  __esModule: true,
  default: {
    randomUUID: () =>
      `00000000-0000-4000-8000-${String((uuidCounter += 1)).padStart(12, "0")}`,
  },
}))

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    store.set(key, value)
    return Promise.resolve()
  }),
}))

describe("getTelemetryInstanceId", () => {
  beforeEach(() => {
    store.clear()
    resetTelemetryInstanceIdCache()
  })

  it("mints a UUID once and keeps returning it", async () => {
    const first = await getTelemetryInstanceId()
    const second = await getTelemetryInstanceId()

    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(second).toBe(first)
  })

  it("survives a cache reset via storage (same install, same id)", async () => {
    const first = await getTelemetryInstanceId()
    resetTelemetryInstanceIdCache()

    await expect(getTelemetryInstanceId()).resolves.toBe(first)
  })

  it("does not collide across installs", async () => {
    const first = await getTelemetryInstanceId()
    store.clear()
    resetTelemetryInstanceIdCache()

    await expect(getTelemetryInstanceId()).resolves.not.toBe(first)
  })

  it("tries storage again after a failed read instead of caching the failure", async () => {
    const AsyncStorage = jest.requireMock("@react-native-async-storage/async-storage")
    AsyncStorage.getItem.mockImplementationOnce(() => Promise.reject(new Error("busy")))

    await expect(getTelemetryInstanceId()).rejects.toThrow("busy")
    await expect(getTelemetryInstanceId()).resolves.toMatch(/^[0-9a-f-]{36}$/)
  })
})
