import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import {
  getOnlineState,
  getServiceStatus,
  isOnline,
  isOnlineStatus,
} from "@app/self-custodial/providers/is-online"

const mockGetSparkStatus = jest.fn()
const mockRecordError = jest.fn()

jest.mock("@react-native-firebase/crashlytics", () => ({
  __esModule: true,
  default: () => ({ recordError: mockRecordError, log: jest.fn() }),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  getSparkStatus: () => mockGetSparkStatus(),
}))

const loadFreshIsOnlineModule = () => {
  let mod: typeof import("@app/self-custodial/providers/is-online") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/providers/is-online")
  })
  return mod!
}

describe("getServiceStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const ALL_STATUSES: ReadonlyArray<{ label: string; status: ServiceStatus }> = [
    { label: "Operational", status: ServiceStatus.Operational },
    { label: "Degraded", status: ServiceStatus.Degraded },
    { label: "Partial", status: ServiceStatus.Partial },
    { label: "Unknown", status: ServiceStatus.Unknown },
    { label: "Major", status: ServiceStatus.Major },
  ]

  ALL_STATUSES.forEach(({ label, status }) => {
    it(`returns ${label} when the SDK reports it`, async () => {
      mockGetSparkStatus.mockResolvedValue({ status, lastUpdated: BigInt(0) })

      expect(await getServiceStatus()).toBe(status)
    })
  })

  it("falls back to Major when getSparkStatus throws (device offline / API down)", async () => {
    mockGetSparkStatus.mockRejectedValue(new Error("network down"))

    expect(await getServiceStatus()).toBe(ServiceStatus.Major)
  })
})

describe("isOnlineStatus", () => {
  it("returns true for Operational", () => {
    expect(isOnlineStatus(ServiceStatus.Operational)).toBe(true)
  })

  it("returns true for Degraded (payments still possible)", () => {
    expect(isOnlineStatus(ServiceStatus.Degraded)).toBe(true)
  })

  const OFFLINE_STATUSES: ReadonlyArray<{ label: string; status: ServiceStatus }> = [
    { label: "Partial", status: ServiceStatus.Partial },
    { label: "Unknown", status: ServiceStatus.Unknown },
    { label: "Major", status: ServiceStatus.Major },
  ]

  OFFLINE_STATUSES.forEach(({ label, status }) => {
    it(`returns false for ${label}`, () => {
      expect(isOnlineStatus(status)).toBe(false)
    })
  })
})

describe("isOnline", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns true when status is Operational", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Operational,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(true)
  })

  it("returns true when status is Degraded", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Degraded,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(true)
  })

  it("returns false when status is Major", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Major,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(false)
  })

  it("returns false when getSparkStatus throws", async () => {
    mockGetSparkStatus.mockRejectedValue(new Error("net down"))

    expect(await isOnline()).toBe(false)
  })
})

describe("getOnlineState (3-state, Critical #4)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 'online' when Spark status is Operational", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Operational,
      lastUpdated: BigInt(0),
    })

    expect(await getOnlineState()).toBe("online")
  })

  it("returns 'online' when Spark status is Degraded", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Degraded,
      lastUpdated: BigInt(0),
    })

    expect(await getOnlineState()).toBe("online")
  })

  it("returns 'offline' for Partial / Unknown / Major statuses", async () => {
    for (const status of [
      ServiceStatus.Partial,
      ServiceStatus.Unknown,
      ServiceStatus.Major,
    ]) {
      mockGetSparkStatus.mockResolvedValue({ status, lastUpdated: BigInt(0) })
      expect(await getOnlineState()).toBe("offline")
    }
  })

  it("returns 'unknown' when getSparkStatus throws (caller can preserve previous status)", async () => {
    mockGetSparkStatus.mockRejectedValue(new Error("auth failed"))

    expect(await getOnlineState()).toBe("unknown")
  })
})

describe("crashlytics reporting on Spark status failures (I4)", () => {
  beforeEach(() => {
    mockRecordError.mockClear()
  })

  it("records to crashlytics once per session when getServiceStatus catches the SDK error", async () => {
    const fresh = loadFreshIsOnlineModule()
    mockGetSparkStatus.mockRejectedValue(new Error("network down"))

    await fresh.getServiceStatus()
    await fresh.getServiceStatus()
    await fresh.getServiceStatus()

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("network down")
  })

  it("records to crashlytics once per session when getOnlineState catches the SDK error", async () => {
    const fresh = loadFreshIsOnlineModule()
    mockGetSparkStatus.mockRejectedValue(new Error("auth failed"))

    await fresh.getOnlineState()
    await fresh.getOnlineState()

    expect(mockRecordError).toHaveBeenCalledTimes(1)
    expect(mockRecordError.mock.calls[0][0].message).toBe("auth failed")
  })

  it("does not record the failure when the SDK eventually returns a status", async () => {
    const fresh = loadFreshIsOnlineModule()
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Operational,
      lastUpdated: BigInt(0),
    })

    await fresh.getServiceStatus()
    await fresh.getOnlineState()

    expect(mockRecordError).not.toHaveBeenCalled()
  })
})
