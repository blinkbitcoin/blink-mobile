jest.mock(
  "react-native-fs",
  () =>
    jest.requireActual<typeof import("../diagnostics/inode-fs")>(
      "../diagnostics/inode-fs",
    ).rnfs,
)

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
}))

const mockRecordErrorOnce = jest.fn()
jest.mock("@app/self-custodial/logging", () => ({
  recordErrorOnce: (...args: unknown[]) => mockRecordErrorOnce(...args),
}))

import {
  failNext,
  hasPath,
  makeDir,
  readText,
  resetDisk,
  writeText,
} from "../diagnostics/inode-fs"

const MAINNET = "/documents/breez-sdk-spark-mainnet"
const REGTEST = "/documents/breez-sdk-spark-regtest"
const WALLET_A = `${MAINNET}/wallet-a`
const WALLET_B = `${MAINNET}/wallet-b`
const WALLET_C = `${REGTEST}/wallet-c`

/** A wallet's SDK storage: a directory holding its database. */
const makeWalletStorage = (dir: string) => {
  makeDir(dir)
  writeText(`${dir}/storage.sql`, `${dir} payment history`)
}

/** The launch sweep runs once per process; each call is a fresh app launch. */
const launch = () => {
  let mod: typeof import("@app/self-custodial/storage/storage-removal") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/storage/storage-removal")
  })
  return mod!
}

describe("storage removal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDisk()
    makeDir(MAINNET)
    makeDir(REGTEST)
  })

  it("removes a marked wallet's storage, then its marker", async () => {
    makeWalletStorage(WALLET_A)
    const removal = launch()

    await removal.markStorageForRemoval(WALLET_A)
    expect(hasPath(`${WALLET_A}.removing`)).toBe(true)
    await removal.removeMarkedStorage(WALLET_A)

    expect(hasPath(WALLET_A)).toBe(false)
    expect(readText(`${WALLET_A}/storage.sql`)).toBeUndefined()
    expect(hasPath(`${WALLET_A}.removing`)).toBe(false)
  })

  it("keeps the marker when the storage can't be removed, for the next try", async () => {
    makeWalletStorage(WALLET_A)
    const removal = launch()
    await removal.markStorageForRemoval(WALLET_A)
    failNext("unlink", WALLET_A, new Error("busy"))

    await expect(removal.removeMarkedStorage(WALLET_A)).rejects.toThrow("busy")

    expect(hasPath(`${WALLET_A}.removing`)).toBe(true)
  })

  it("unmarks a wallet whose deletion stopped, leaving its storage", async () => {
    makeWalletStorage(WALLET_A)
    const removal = launch()
    await removal.markStorageForRemoval(WALLET_A)

    await removal.unmarkStorageForRemoval(WALLET_A)

    expect(hasPath(`${WALLET_A}.removing`)).toBe(false)
    expect(hasPath(WALLET_A)).toBe(true)
  })

  it("sweeps every marked wallet on both networks at launch, and nothing else", async () => {
    makeWalletStorage(WALLET_A)
    makeWalletStorage(WALLET_B)
    makeWalletStorage(WALLET_C)
    await launch().markStorageForRemoval(WALLET_A)
    await launch().markStorageForRemoval(WALLET_C)

    await launch().finishPendingStorageRemovals()

    expect(
      [WALLET_A, `${WALLET_A}.removing`, WALLET_C, `${WALLET_C}.removing`].some(hasPath),
    ).toBe(false)
    expect(hasPath(WALLET_B)).toBe(true)
  })

  it("removes storage an SDK recreated after a timed-out deletion", async () => {
    makeWalletStorage(WALLET_A)
    await launch().markStorageForRemoval(WALLET_A)
    // the deletion's own removal ran, then the late connect recreated the directory
    makeWalletStorage(WALLET_A)

    await launch().finishPendingStorageRemovals()

    expect(hasPath(WALLET_A)).toBe(false)
  })

  it("sweeps once per launch", async () => {
    const removal = launch()
    await removal.finishPendingStorageRemovals()
    makeWalletStorage(WALLET_A)
    await removal.markStorageForRemoval(WALLET_A)

    await removal.finishPendingStorageRemovals()

    expect(hasPath(WALLET_A)).toBe(true)
  })

  it("records a wallet it couldn't sweep and still sweeps the rest", async () => {
    makeWalletStorage(WALLET_A)
    makeWalletStorage(WALLET_B)
    await launch().markStorageForRemoval(WALLET_A)
    await launch().markStorageForRemoval(WALLET_B)
    failNext("unlink", WALLET_A, new Error("busy"))

    await launch().finishPendingStorageRemovals()

    expect(hasPath(`${WALLET_A}.removing`)).toBe(true)
    expect(hasPath(WALLET_B)).toBe(false)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-storage-removal",
      expect.objectContaining({ message: "busy" }),
      { expected: true },
    )
  })

  it("never rejects, even when a network's directory can't be listed", async () => {
    failNext("readDir", MAINNET, new Error("io error"))

    await expect(launch().finishPendingStorageRemovals()).resolves.toBeUndefined()
  })
})
