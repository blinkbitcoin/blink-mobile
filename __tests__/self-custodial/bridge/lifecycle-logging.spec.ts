jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
}))

const mockCalls: string[] = []
const mockConnect = jest.fn(async () => {
  mockCalls.push("connect")
  return { id: "sdk" }
})

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: { Mnemonic: jest.fn().mockImplementation((args: object) => args) },
  MaxFee: { create: (fee: object) => fee },
  MaxOnchainFee: { NetworkRecommended: jest.fn().mockImplementation((inner) => inner) },
  connect: () => mockConnect(),
  defaultConfig: () => ({}),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({ __esModule: true, default: {} }))
jest.mock("@app/self-custodial/storage/account-index", () => ({}))
jest.mock("react-native-quick-crypto", () => ({}))

const mockStartSdkLogger = jest.fn()
jest.mock("@app/self-custodial/diagnostics/sdk-log-files", () => ({
  startSdkLogger: () => mockStartSdkLogger(),
}))

import { initSdk } from "@app/self-custodial/bridge/lifecycle"

const params = {
  mnemonic: "word1 word2 word3",
  storageDir: "/test/storage",
  network: 1,
  leewaySatPerVbyte: 1,
}

/** The logger's own lifecycle is covered in diagnostics/sdk-log-files.spec.ts. */
describe("initSdk logging", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCalls.length = 0
  })

  it("waits for the SDK logger before connecting, so the file holds the connect", async () => {
    let finishStart: () => void = () => {}
    mockStartSdkLogger.mockReturnValue(
      new Promise<void>((resolve) => {
        finishStart = () => {
          mockCalls.push("logger started")
          resolve()
        }
      }),
    )

    const connecting = initSdk(params)
    await Promise.resolve()
    expect(mockConnect).not.toHaveBeenCalled()

    finishStart()
    await connecting

    expect(mockCalls).toEqual(["logger started", "connect"])
  })

  it("starts the logger on every connect and leaves once-per-process to it", async () => {
    mockStartSdkLogger.mockResolvedValue(undefined)

    await initSdk(params)
    await initSdk(params)

    expect(mockStartSdkLogger).toHaveBeenCalledTimes(2)
    expect(mockConnect).toHaveBeenCalledTimes(2)
  })
})
