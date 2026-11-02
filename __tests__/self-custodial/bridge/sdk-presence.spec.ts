jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
}))

type FakeSdk = { name: string; disconnect: jest.Mock }

const makeSdk = (name: string): FakeSdk => ({
  name,
  disconnect: jest.fn().mockResolvedValue(undefined),
})

const mockConnect = jest.fn()
jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: { Mnemonic: jest.fn().mockImplementation((args: object) => args) },
  MaxFee: { create: (fee: object) => fee },
  MaxOnchainFee: { NetworkRecommended: jest.fn().mockImplementation((inner) => inner) },
  connect: (args: { storageDir: string }) => mockConnect(args),
  defaultConfig: () => ({}),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({ __esModule: true, default: {} }))
jest.mock("@app/self-custodial/storage/account-index", () => ({}))
jest.mock("react-native-quick-crypto", () => ({}))
const mockStartSdkLogger = jest.fn()
jest.mock("@app/self-custodial/diagnostics/sdk-log-files", () => ({
  startSdkLogger: () => mockStartSdkLogger(),
}))
const mockFinishPendingStorageRemovals = jest.fn()
jest.mock("@app/self-custodial/storage/storage-removal", () => ({
  finishPendingStorageRemovals: () => mockFinishPendingStorageRemovals(),
}))

import type { BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

const WALLET_A = "/documents/breez-sdk-spark-mainnet/wallet-a"
const WALLET_B = "/documents/breez-sdk-spark-mainnet/wallet-b"

/** The presence registry is module state, so each case gets a fresh lifecycle. */
const loadLifecycle = () => {
  let mod: typeof import("@app/self-custodial/bridge/lifecycle") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/bridge/lifecycle")
  })
  return mod!
}

const connectTo = (
  lifecycle: ReturnType<typeof loadLifecycle>,
  storageDir: string,
): Promise<BreezSdkInterface> =>
  lifecycle.initSdk({ mnemonic: "m", storageDir, network: 0, leewaySatPerVbyte: 1 })

/** A connect that stays in flight until the returned release is called, whenever the
 *  connect itself starts. */
const holdConnect = (sdk: FakeSdk) => {
  let release: () => void = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })
  mockConnect.mockImplementationOnce(async () => {
    await released
    return sdk
  })
  return () => release()
}

const isSettled = async (promise: Promise<unknown>): Promise<boolean> => {
  const pending = Symbol("pending")
  return (await Promise.race([promise, Promise.resolve(pending)])) !== pending
}

describe("waitForSdkIdle", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConnect.mockImplementation(async () => makeSdk("default"))
    mockStartSdkLogger.mockResolvedValue(undefined)
    mockFinishPendingStorageRemovals.mockResolvedValue(undefined)
  })

  it("resolves at once for a wallet with no SDK", async () => {
    await expect(loadLifecycle().waitForSdkIdle(WALLET_A, 1000)).resolves.toBe(true)
  })

  it("waits out a connect in flight and its disconnect, not just the connect", async () => {
    const lifecycle = loadLifecycle()
    const sdk = makeSdk("a")
    const finishConnect = holdConnect(sdk)
    const connecting = connectTo(lifecycle, WALLET_A)

    const idle = lifecycle.waitForSdkIdle(WALLET_A, 1000)
    finishConnect()
    const connected = await connecting
    expect(await isSettled(idle)).toBe(false)

    await lifecycle.disconnectSdk(connected)

    await expect(idle).resolves.toBe(true)
  })

  it("counts a connect that failed as gone", async () => {
    const lifecycle = loadLifecycle()
    mockConnect.mockRejectedValueOnce(new Error("InvalidInput"))

    await expect(connectTo(lifecycle, WALLET_A)).rejects.toThrow("InvalidInput")

    await expect(lifecycle.waitForSdkIdle(WALLET_A, 1000)).resolves.toBe(true)
  })

  it("wakes a deletion already waiting when the connect in flight fails", async () => {
    const lifecycle = loadLifecycle()
    let fail: () => void = () => {}
    const failed = new Promise<void>((resolve) => {
      fail = resolve
    })
    mockConnect.mockImplementationOnce(async () => {
      await failed
      throw new Error("network down")
    })
    const connecting = connectTo(lifecycle, WALLET_A).catch(() => undefined)

    const idle = lifecycle.waitForSdkIdle(WALLET_A, 1000)
    expect(await isSettled(idle)).toBe(false)
    fail()
    await connecting

    await expect(idle).resolves.toBe(true)
  })

  it("isn't held up by another wallet's SDK", async () => {
    const lifecycle = loadLifecycle()
    await connectTo(lifecycle, WALLET_B)

    await expect(lifecycle.waitForSdkIdle(WALLET_A, 1000)).resolves.toBe(true)
    await expect(lifecycle.waitForSdkIdle(WALLET_B, 10)).resolves.toBe(false)
  })

  it("treats a second disconnect of the same instance as harmless", async () => {
    const lifecycle = loadLifecycle()
    const sdk = await connectTo(lifecycle, WALLET_A)

    await lifecycle.disconnectSdk(sdk)
    await lifecycle.disconnectSdk(sdk)

    await expect(lifecycle.waitForSdkIdle(WALLET_A, 1000)).resolves.toBe(true)
  })

  it("never counts an instance whose disconnect failed as gone, and gives up in time", async () => {
    const lifecycle = loadLifecycle()
    const sdk = makeSdk("a")
    sdk.disconnect.mockRejectedValueOnce(new Error("still running"))
    mockConnect.mockResolvedValueOnce(sdk)
    const connected = await connectTo(lifecycle, WALLET_A)

    await expect(lifecycle.disconnectSdk(connected)).rejects.toThrow("still running")

    await expect(lifecycle.waitForSdkIdle(WALLET_A, 10)).resolves.toBe(false)
  })

  it("waits for every instance of the wallet, a probe's included", async () => {
    const lifecycle = loadLifecycle()
    mockConnect
      .mockResolvedValueOnce(makeSdk("lifecycle"))
      .mockResolvedValueOnce(makeSdk("probe"))
    const first = await connectTo(lifecycle, WALLET_A)
    const second = await connectTo(lifecycle, WALLET_A)

    const idle = lifecycle.waitForSdkIdle(WALLET_A, 1000)
    await lifecycle.disconnectSdk(first)
    expect(await isSettled(idle)).toBe(false)
    await lifecycle.disconnectSdk(second)

    await expect(idle).resolves.toBe(true)
  })
})

describe("retireSdkStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConnect.mockImplementation(async () => makeSdk("default"))
    mockStartSdkLogger.mockResolvedValue(undefined)
    mockFinishPendingStorageRemovals.mockResolvedValue(undefined)
  })

  it("refuses a retired wallet's connect, and doesn't leave it counted", async () => {
    const lifecycle = loadLifecycle()
    lifecycle.retireSdkStorage(WALLET_A)

    await expect(connectTo(lifecycle, WALLET_A)).rejects.toBeInstanceOf(
      lifecycle.SdkStorageRetiredError,
    )

    expect(mockConnect).not.toHaveBeenCalled()
    await expect(lifecycle.waitForSdkIdle(WALLET_A, 10)).resolves.toBe(true)
  })

  it("refuses at the point of no return when retired while start-up waited on the logger", async () => {
    const lifecycle = loadLifecycle()
    let finishLoggerStart: () => void = () => {}
    mockStartSdkLogger.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishLoggerStart = resolve
      }),
    )

    // a lifecycle that read the mnemonic before the deletion began (#4351 review 4, finding 1)
    const connecting = connectTo(lifecycle, WALLET_A)
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
    expect(mockStartSdkLogger).toHaveBeenCalledTimes(1)
    lifecycle.retireSdkStorage(WALLET_A)
    finishLoggerStart()

    await expect(connecting).rejects.toBeInstanceOf(lifecycle.SdkStorageRetiredError)
    expect(mockConnect).not.toHaveBeenCalled()
    await expect(lifecycle.waitForSdkIdle(WALLET_A, 10)).resolves.toBe(true)
  })

  it("connects only once a deleted wallet's leftover storage has been swept", async () => {
    const lifecycle = loadLifecycle()
    let finishSweep: () => void = () => {}
    mockFinishPendingStorageRemovals.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSweep = resolve
      }),
    )

    const connecting = connectTo(lifecycle, WALLET_B)
    await new Promise((resolve) => {
      setImmediate(resolve)
    })
    expect(mockFinishPendingStorageRemovals).toHaveBeenCalledTimes(1)
    expect(mockConnect).not.toHaveBeenCalled()
    finishSweep()

    await expect(connecting).resolves.toBeDefined()
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it("lets a readmitted wallet connect again", async () => {
    const lifecycle = loadLifecycle()
    lifecycle.retireSdkStorage(WALLET_A)
    lifecycle.readmitSdkStorage(WALLET_A)

    await expect(connectTo(lifecycle, WALLET_A)).resolves.toBeDefined()
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it("leaves every other wallet free to connect", async () => {
    const lifecycle = loadLifecycle()
    lifecycle.retireSdkStorage(WALLET_A)

    await expect(connectTo(lifecycle, WALLET_B)).resolves.toBeDefined()
    expect(mockConnect).toHaveBeenCalledWith(
      expect.objectContaining({ storageDir: WALLET_B }),
    )
  })
})
