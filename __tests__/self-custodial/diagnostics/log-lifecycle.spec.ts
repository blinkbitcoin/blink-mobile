/**
 * Delete a wallet, restore or create another in the same process, export, relaunch.
 * The SDK's logger is process-global, keeps its file open and can't tell wallets apart,
 * so these are the sequences where deleting and logging have to agree (#4351 reviews).
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
  everythingOnDisk,
  loggerStarts,
  readText,
  resetDisk,
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
  const { resetSdkLogs, finishPendingSdkLogReset } = logFiles!
  const { exportSdkLogs } = exporter!
  return {
    connectWallet: () =>
      initSdk({ mnemonic: "m", storageDir: "/s", network: 0, leewaySatPerVbyte: 1 }),
    deleteWallet: resetSdkLogs,
    /** What SdkLogResetMount runs at app start. */
    appStarts: finishPendingSdkLogReset,
    exportText: async () => {
      const path = await exportSdkLogs("header\n", NOW)
      return path === null ? null : readText(path)!
    },
  }
}

describe("deleting a wallet while the SDK logger runs", () => {
  beforeEach(() => {
    resetDisk()
  })

  it("exports the next wallet's lines without a restart, and never the deleted one's", async () => {
    const app = launch()
    await app.connectWallet()
    sdkWrites(WALLET_A)
    await expect(app.exportText()).resolves.toContain(WALLET_A)

    await app.deleteWallet()
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
    await first.deleteWallet()
    await first.connectWallet()
    sdkWrites(WALLET_B)
    endProcess()

    const second = launch()
    await second.appStarts()
    await second.connectWallet()
    sdkWrites("next session")

    await expect(second.exportText()).resolves.toBe(
      "header\n\n--- sdk.log ---\nnext session\n",
    )
    expect(everythingOnDisk()).not.toContain(WALLET_A)
  })

  it("removes them at the next launch even if no wallet connects again", async () => {
    const first = launch()
    await first.connectWallet()
    sdkWrites(WALLET_A)
    await first.exportText()
    await first.deleteWallet()
    endProcess()

    await launch().appStarts()

    expect(everythingOnDisk()).not.toContain(WALLET_A)
  })

  it("removes them when the process stops right after the reset, before the wallet is gone", async () => {
    const first = launch()
    await first.connectWallet()
    sdkWrites(WALLET_A)
    // use-delete-account resets the logs first; the process stops before the mnemonic goes
    await first.deleteWallet()
    endProcess()

    await launch().appStarts()

    expect(everythingOnDisk()).not.toContain(WALLET_A)
  })

  it("exports nothing from before the reset when exporting ahead of the next app start", async () => {
    const first = launch()
    await first.connectWallet()
    sdkWrites(WALLET_A)
    await first.deleteWallet()
    await first.connectWallet()
    sdkWrites(WALLET_B)
    endProcess()

    await expect(launch().exportText()).resolves.toBeNull()
  })
})
