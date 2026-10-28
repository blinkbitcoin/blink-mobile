/**
 * Delete the last wallet, restore or create another in the same process, then export.
 * The SDK's logger is process-global and keeps its file open, so this is the sequence
 * where deleting and logging have to agree (#4351 review).
 */
jest.mock(
  "react-native-fs",
  () => jest.requireActual<typeof import("./inode-fs")>("./inode-fs").rnfs,
)

jest.mock("react-native-config", () => ({
  SPARK_TOKEN_IDENTIFIER: "test-token-id",
  BREEZ_API_KEY: "test-api-key",
}))

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  Seed: { Mnemonic: jest.fn().mockImplementation((args: object) => args) },
  MaxFee: { create: (fee: object) => fee },
  MaxOnchainFee: { NetworkRecommended: jest.fn().mockImplementation((inner) => inner) },
  defaultConfig: () => ({}),
  connect: async () => ({ id: "sdk" }),
  initLogging: (logDir: string | undefined) =>
    jest.requireActual<typeof import("./inode-fs")>("./inode-fs").initLogging(logDir),
}))

jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: () => ({ log: () => undefined }),
  recordErrorOnce: jest.fn(),
}))
jest.mock("@app/utils/storage/secureStorage", () => ({ __esModule: true, default: {} }))
jest.mock("@app/self-custodial/storage/account-index", () => ({}))
jest.mock("react-native-quick-crypto", () => ({}))

import {
  endProcess,
  loggerStarts,
  readText,
  resetDisk,
  rnfs,
  sdkWrites,
} from "./inode-fs"

const NOW = new Date("2026-10-28T09:05:00Z")
const WALLET_A = "Synced payment: wallet A paid lnbc1aaaa to alice@blink.sv"
const WALLET_B = "Synced payment: wallet B received 2000 sats"

/** One app process: the lifecycle, deletion and export modules sharing its state. */
const launch = () => {
  let lifecycle: typeof import("@app/self-custodial/bridge/lifecycle") | undefined
  let logFiles: typeof import("@app/self-custodial/diagnostics/sdk-log-files") | undefined
  let exporter:
    | typeof import("@app/self-custodial/diagnostics/export-sdk-logs")
    | undefined
  jest.isolateModules(() => {
    lifecycle = require("@app/self-custodial/bridge/lifecycle")
    logFiles = require("@app/self-custodial/diagnostics/sdk-log-files")
    exporter = require("@app/self-custodial/diagnostics/export-sdk-logs")
  })
  const { initSdk } = lifecycle!
  const { deleteSdkLogs } = logFiles!
  const { exportSdkLogs } = exporter!
  return {
    connectWallet: () =>
      initSdk({ mnemonic: "m", storageDir: "/s", network: 0, leewaySatPerVbyte: 1 }),
    deleteSdkLogs,
    exportText: async () => {
      const path = await exportSdkLogs("header\n", NOW)
      return path === null ? null : readText(path)!
    },
  }
}

/** Every byte on the fake disk, to prove the deleted wallet's lines are gone. */
const everythingOnDisk = async (): Promise<string> => {
  const paths = [
    "/caches/breez-sdk-logs/sdk.log",
    "/caches/breez-sdk-logs/sdk.log.1",
    "/caches/breez-sdk-logs/sdk.log.purge",
  ]
  const exportsDir = "/caches/breez-sdk-log-exports"
  const texts = await Promise.all(
    paths.map(async (path) => ((await rnfs.exists(path)) ? readText(path) : "")),
  )
  return texts.join("\n") + ((await rnfs.exists(exportsDir)) ? "[exports present]" : "")
}

describe("deleting the last wallet while the SDK logger runs", () => {
  beforeEach(() => {
    resetDisk()
  })

  it("exports the next wallet's lines without a restart, and never the deleted one's", async () => {
    const app = launch()
    await app.connectWallet()
    sdkWrites(WALLET_A)
    await expect(app.exportText()).resolves.toContain(WALLET_A)

    await app.deleteSdkLogs()
    await expect(app.exportText()).resolves.toBeNull()

    await app.connectWallet()
    sdkWrites(WALLET_B)
    const exported = await app.exportText()

    expect(loggerStarts()).toBe(1)
    expect(exported).toContain(WALLET_B)
    expect(exported).not.toContain(WALLET_A)
  })

  it("leaves none of the deleted wallet's lines on disk after the next launch", async () => {
    const first = launch()
    await first.connectWallet()
    sdkWrites(WALLET_A)
    await first.exportText()
    await first.deleteSdkLogs()
    await first.connectWallet()
    sdkWrites(WALLET_B)
    endProcess()

    const second = launch()
    await second.connectWallet()
    sdkWrites("next session")
    const exported = await second.exportText()

    expect(exported).toContain(WALLET_B)
    expect(exported).toContain("next session")
    expect(exported).not.toContain(WALLET_A)
    expect(await everythingOnDisk()).not.toContain(WALLET_A)
  })

  it("excludes the deleted lines from an export made before the next connect", async () => {
    const first = launch()
    await first.connectWallet()
    sdkWrites(WALLET_A)
    await first.deleteSdkLogs()
    await first.connectWallet()
    sdkWrites(WALLET_B)
    endProcess()

    const exported = await launch().exportText()

    expect(exported).toContain(WALLET_B)
    expect(exported).not.toContain(WALLET_A)
  })
})
