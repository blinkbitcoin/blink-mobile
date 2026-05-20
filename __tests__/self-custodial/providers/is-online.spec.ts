import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import { getOnlineState, isOnline } from "@app/self-custodial/providers/is-online"

const mockGetSparkStatus = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  getSparkStatus: () => mockGetSparkStatus(),
}))

describe("isOnline (boolean wrapper, backward-compat)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns true when Spark status is Operational", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Operational,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(true)
  })

  it("returns true when Spark status is Degraded (payments still possible)", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Degraded,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(true)
  })

  it("returns false when Spark status is Partial", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Partial,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(false)
  })

  it("returns false when Spark status is Unknown", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Unknown,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(false)
  })

  it("returns false when Spark status is Major outage", async () => {
    mockGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Major,
      lastUpdated: BigInt(0),
    })

    expect(await isOnline()).toBe(false)
  })

  it("returns false when getSparkStatus throws (device offline / status API unreachable)", async () => {
    mockGetSparkStatus.mockRejectedValue(new Error("Network request failed"))

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
