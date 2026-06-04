import { PaymentResultStatus } from "@app/types/payment"

import { createLnurlWithdraw } from "@app/self-custodial/bridge/lnurl-withdraw"

const mockClassifySdkError = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  LnurlWithdrawRequest: { create: (p: Record<string, unknown>) => p },
  LnurlWithdrawRequestDetails: { create: (p: Record<string, unknown>) => p },
}))

jest.mock("@app/self-custodial/sdk-error", () => ({
  classifySdkError: (...args: unknown[]) => mockClassifySdkError(...args),
}))

const baseParams = {
  amountSats: 1500,
  callback: "https://lnurl.example/withdraw",
  k1: "random_k1_value",
  defaultDescription: "Test withdraw",
  minWithdrawableMsats: 1_000_000,
  maxWithdrawableMsats: 5_000_000,
}

describe("createLnurlWithdraw — success path", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns { status: Success } when sdk.lnurlWithdraw resolves", async () => {
    const lnurlWithdraw = jest.fn().mockResolvedValue(undefined)
    const sdk = { lnurlWithdraw } as never

    const result = await createLnurlWithdraw(sdk)(baseParams)

    expect(result).toEqual({ status: PaymentResultStatus.Success })
    expect(lnurlWithdraw).toHaveBeenCalledTimes(1)
    expect(mockClassifySdkError).not.toHaveBeenCalled()
  })
})

describe("createLnurlWithdraw — request shape", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("forwards amountSats as BigInt and msats limits as BigInt to the SDK request", async () => {
    const lnurlWithdraw = jest.fn().mockResolvedValue(undefined)
    const sdk = { lnurlWithdraw } as never

    await createLnurlWithdraw(sdk)(baseParams)

    expect(lnurlWithdraw).toHaveBeenCalledTimes(1)
    const requestArg = lnurlWithdraw.mock.calls[0][0]
    expect(requestArg.amountSats).toBe(BigInt(1500))
    expect(typeof requestArg.amountSats).toBe("bigint")
    expect(requestArg.withdrawRequest.minWithdrawable).toBe(BigInt(1_000_000))
    expect(requestArg.withdrawRequest.maxWithdrawable).toBe(BigInt(5_000_000))
    expect(typeof requestArg.withdrawRequest.minWithdrawable).toBe("bigint")
    expect(typeof requestArg.withdrawRequest.maxWithdrawable).toBe("bigint")
    expect(requestArg.withdrawRequest.callback).toBe(baseParams.callback)
    expect(requestArg.withdrawRequest.k1).toBe(baseParams.k1)
    expect(requestArg.withdrawRequest.defaultDescription).toBe(
      baseParams.defaultDescription,
    )
  })

  it("defaults completionTimeoutSecs to 120 when caller omits it", async () => {
    const lnurlWithdraw = jest.fn().mockResolvedValue(undefined)
    const sdk = { lnurlWithdraw } as never

    await createLnurlWithdraw(sdk)(baseParams)

    const requestArg = lnurlWithdraw.mock.calls[0][0]
    expect(requestArg.completionTimeoutSecs).toBe(120)
  })

  it("forwards an explicit completionTimeoutSecs override", async () => {
    const lnurlWithdraw = jest.fn().mockResolvedValue(undefined)
    const sdk = { lnurlWithdraw } as never

    await createLnurlWithdraw(sdk)({ ...baseParams, completionTimeoutSecs: 45 })

    const requestArg = lnurlWithdraw.mock.calls[0][0]
    expect(requestArg.completionTimeoutSecs).toBe(45)
  })
})

describe("createLnurlWithdraw — abort signal handling", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("passes { signal } as the SDK options when an AbortSignal is provided", async () => {
    const lnurlWithdraw = jest.fn().mockResolvedValue(undefined)
    const sdk = { lnurlWithdraw } as never
    const controller = new AbortController()

    await createLnurlWithdraw(sdk)({ ...baseParams, signal: controller.signal })

    expect(lnurlWithdraw).toHaveBeenCalledTimes(1)
    expect(lnurlWithdraw.mock.calls[0][1]).toEqual({ signal: controller.signal })
  })

  it("omits the SDK options argument when no signal is provided", async () => {
    const lnurlWithdraw = jest.fn().mockResolvedValue(undefined)
    const sdk = { lnurlWithdraw } as never

    await createLnurlWithdraw(sdk)(baseParams)

    expect(lnurlWithdraw).toHaveBeenCalledTimes(1)
    expect(lnurlWithdraw.mock.calls[0][1]).toBeUndefined()
  })
})

describe("createLnurlWithdraw — error mapping", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns { status: Failed, errors: [{ message: <classified code> }] } when sdk.lnurlWithdraw rejects", async () => {
    const sdkErr = new Error("raw sdk failure")
    const lnurlWithdraw = jest.fn().mockRejectedValue(sdkErr)
    const sdk = { lnurlWithdraw } as never
    mockClassifySdkError.mockReturnValueOnce("sc_network_error")

    const result = await createLnurlWithdraw(sdk)(baseParams)

    expect(result).toEqual({
      status: PaymentResultStatus.Failed,
      errors: [{ message: "sc_network_error" }],
    })
    expect(mockClassifySdkError).toHaveBeenCalledTimes(1)
    expect(mockClassifySdkError).toHaveBeenCalledWith(sdkErr)
  })
})
