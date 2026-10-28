jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
}))

const mockCalls: string[] = []
const mockConnect = jest.fn(async () => {
  mockCalls.push("connect")
  return { id: "sdk" }
})
const mockInitLogging = jest.fn((logDir: string | undefined, ..._rest: unknown[]) => {
  mockCalls.push(`initLogging:${logDir ?? "none"}`)
})

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: { Mnemonic: jest.fn().mockImplementation((args: object) => args) },
  MaxFee: { create: (fee: object) => fee },
  MaxOnchainFee: { NetworkRecommended: jest.fn().mockImplementation((inner) => inner) },
  connect: () => mockConnect(),
  defaultConfig: () => ({}),
  initLogging: (logDir: string | undefined, ...rest: unknown[]) =>
    mockInitLogging(logDir, ...rest),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({ __esModule: true, default: {} }))
jest.mock("@app/self-custodial/storage/account-index", () => ({}))
jest.mock("react-native-quick-crypto", () => ({}))

const mockPrepareSdkLogDir = jest.fn<Promise<string | undefined>, []>()
jest.mock("@app/self-custodial/diagnostics/sdk-log-files", () => ({
  prepareSdkLogDir: () => mockPrepareSdkLogDir(),
}))

const mockRecordErrorOnce = jest.fn()
jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: () => ({ log: jest.fn() }),
  recordErrorOnce: (...args: unknown[]) => mockRecordErrorOnce(...args),
}))

const DIR = "/caches/breez-sdk-logs"

/** The once-per-process guard is module state, so each case loads a fresh lifecycle. */
const loadInitSdk = () => {
  let mod: typeof import("@app/self-custodial/bridge/lifecycle") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/bridge/lifecycle")
  })
  return mod!.initSdk
}

const params = {
  mnemonic: "word1 word2 word3",
  storageDir: "/test/storage",
  network: 1,
  leewaySatPerVbyte: 1,
}

describe("initSdk logging", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCalls.length = 0
    mockPrepareSdkLogDir.mockResolvedValue(DIR)
  })

  it("starts the SDK logger on the prepared directory before connecting", async () => {
    const initSdk = loadInitSdk()

    await initSdk(params)

    expect(mockCalls).toEqual([`initLogging:${DIR}`, "connect"])
    expect(mockInitLogging).toHaveBeenCalledWith(
      DIR,
      expect.objectContaining({ log: expect.any(Function) }),
      undefined,
    )
  })

  it("retries without a file, keeping the listener, when the file cannot be opened", async () => {
    mockInitLogging.mockImplementationOnce(() => {
      throw new Error("Permission denied")
    })
    const initSdk = loadInitSdk()

    await initSdk(params)

    expect(mockInitLogging).toHaveBeenCalledTimes(2)
    expect(mockInitLogging).toHaveBeenLastCalledWith(
      undefined,
      expect.objectContaining({ log: expect.any(Function) }),
      undefined,
    )
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-file-init",
      expect.objectContaining({ message: "Permission denied" }),
    )
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it("stays silent when the retry fails too, since the file was not the cause", async () => {
    const alreadyInitialised = () => {
      throw new Error("already initialised")
    }
    mockInitLogging
      .mockImplementationOnce(alreadyInitialised)
      .mockImplementationOnce(alreadyInitialised)
    const initSdk = loadInitSdk()

    await initSdk(params)

    expect(mockInitLogging).toHaveBeenCalledTimes(2)
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it("logs without a file, and does not retry, when the directory is unusable", async () => {
    mockPrepareSdkLogDir.mockResolvedValue(undefined)
    mockInitLogging.mockImplementationOnce(() => {
      throw new Error("already initialised")
    })
    const initSdk = loadInitSdk()

    await initSdk(params)

    expect(mockInitLogging).toHaveBeenCalledTimes(1)
    expect(mockInitLogging).toHaveBeenCalledWith(undefined, expect.anything(), undefined)
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  it("still connects when preparing the directory rejects", async () => {
    mockPrepareSdkLogDir.mockRejectedValue(new Error("unexpected"))
    const initSdk = loadInitSdk()

    await initSdk(params)

    expect(mockCalls).toEqual(["initLogging:none", "connect"])
  })

  it("starts the logger once for connects that race, and once per process after", async () => {
    let releasePrepare: (dir: string) => void = () => {}
    mockPrepareSdkLogDir.mockReturnValueOnce(
      new Promise((resolve) => {
        releasePrepare = resolve
      }),
    )
    const initSdk = loadInitSdk()

    const first = initSdk(params)
    const second = initSdk(params)
    releasePrepare(DIR)
    await Promise.all([first, second])
    await initSdk(params)

    expect(mockConnect).toHaveBeenCalledTimes(3)
    expect(mockPrepareSdkLogDir).toHaveBeenCalledTimes(1)
    expect(mockInitLogging).toHaveBeenCalledTimes(1)
  })
})
