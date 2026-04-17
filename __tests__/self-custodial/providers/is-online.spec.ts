import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import { isOnline } from "@app/self-custodial/providers/is-online"

const mockGetSparkStatus = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  getSparkStatus: () => mockGetSparkStatus(),
}))

describe("isOnline", () => {
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
