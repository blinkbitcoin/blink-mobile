import { ServiceStatus } from "@breeztech/breez-sdk-spark-react-native"

import { getSparkStatus } from "@app/self-custodial/bridge/status"

const mockBreezGetSparkStatus = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  ServiceStatus: {
    Operational: 0,
    Degraded: 1,
    Partial: 2,
    Unknown: 3,
    Major: 4,
  },
  GetSparkStatusRequest: { create: (p: object) => p },
  getSparkStatus: (...args: unknown[]) => mockBreezGetSparkStatus(...args),
}))

describe("getSparkStatus (bridge)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("delegates to the Breez SDK getSparkStatus", async () => {
    mockBreezGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Operational,
      lastUpdated: BigInt(1700000000),
    })

    const result = await getSparkStatus()

    expect(mockBreezGetSparkStatus).toHaveBeenCalledTimes(1)
    expect(result.status).toBe(ServiceStatus.Operational)
  })

  it("propagates errors from the SDK (network unreachable, etc.)", async () => {
    mockBreezGetSparkStatus.mockRejectedValue(new Error("network"))

    await expect(getSparkStatus()).rejects.toThrow("network")
  })

  it("forwards an AbortSignal to the SDK when provided", async () => {
    mockBreezGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Operational,
      lastUpdated: BigInt(0),
    })
    const controller = new AbortController()

    await getSparkStatus(controller.signal)

    expect(mockBreezGetSparkStatus.mock.calls[0]).toStrictEqual([
      { proxy: undefined },
      { signal: controller.signal },
    ])
  })

  it("sends the request without call options when no signal is provided", async () => {
    mockBreezGetSparkStatus.mockResolvedValue({
      status: ServiceStatus.Operational,
      lastUpdated: BigInt(0),
    })

    await getSparkStatus()

    expect(mockBreezGetSparkStatus.mock.calls[0]).toStrictEqual([{ proxy: undefined }])
  })
})
