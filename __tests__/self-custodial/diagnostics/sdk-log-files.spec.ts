jest.mock(
  "react-native-fs",
  () => jest.requireActual<typeof import("./inode-fs")>("./inode-fs").rnfs,
)

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  Network: { Mainnet: 0, Regtest: 1 },
  initLogging: (logDir: string | undefined) =>
    jest.requireActual<typeof import("./inode-fs")>("./inode-fs").initLogging(logDir),
}))

const mockRecordErrorOnce = jest.fn()
jest.mock("@app/self-custodial/logging", () => ({
  createSdkLogListener: () => ({ log: () => undefined }),
  recordErrorOnce: (...args: unknown[]) => mockRecordErrorOnce(...args),
}))

import { SDK_LOG_ROTATE_BYTES } from "@app/self-custodial/config"

import {
  endProcess,
  failNext,
  hasPath,
  loggerStarts,
  makeDir,
  readText,
  resetDisk,
  sdkWrites,
  writeText,
} from "./inode-fs"

const DIR = "/caches/breez-sdk-logs"
const CURRENT = `${DIR}/sdk.log`
const PREVIOUS = `${DIR}/sdk.log.1`
const FLAG = `${DIR}/sdk.log.reset`
const EXPORTS = "/caches/breez-sdk-log-exports"

/** The module's state is per process; each call is a fresh app launch on the same disk. */
const launch = () => {
  let mod: typeof import("@app/self-custodial/diagnostics/sdk-log-files") | undefined
  jest.isolateModules(() => {
    mod = require("@app/self-custodial/diagnostics/sdk-log-files")
  })
  return mod!
}

const oversized = (fill: string) => fill.repeat(SDK_LOG_ROTATE_BYTES + 1)

describe("startSdkLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDisk()
  })

  it("opens sdk.log in the caches directory on a first launch", async () => {
    await launch().startSdkLogger()
    sdkWrites("first line")

    expect(readText(CURRENT)).toBe("first line\n")
    expect(loggerStarts()).toBe(1)
  })

  it("starts once for connects that race, and once per process after", async () => {
    const logs = launch()

    await Promise.all([logs.startSdkLogger(), logs.startSdkLogger()])
    await logs.startSdkLogger()

    expect(loggerStarts()).toBe(1)
  })

  it("keeps appending to a log at the cap", async () => {
    writeText(CURRENT, "x".repeat(SDK_LOG_ROTATE_BYTES))

    await launch().startSdkLogger()

    expect(hasPath(PREVIOUS)).toBe(false)
    expect(readText(CURRENT)).toHaveLength(SDK_LOG_ROTATE_BYTES)
  })

  it("moves a log over the cap aside, replacing the previous generation", async () => {
    writeText(PREVIOUS, "oldest")
    writeText(CURRENT, oversized("a"))

    await launch().startSdkLogger()
    sdkWrites("fresh")

    expect(readText(PREVIOUS)).toBe(oversized("a"))
    expect(readText(CURRENT)).toBe("fresh\n")
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })

  it("drops an oversized log it cannot move, so the file cannot grow without bound", async () => {
    writeText(CURRENT, oversized("a"))
    failNext("moveFile", CURRENT, new Error("move failed"))

    await launch().startSdkLogger()
    sdkWrites("fresh")

    expect(readText(CURRENT)).toBe("fresh\n")
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-rotate",
      expect.objectContaining({ message: "move failed" }),
      { expected: true },
    )
  })

  it("still opens the file when the rotation fallback fails too", async () => {
    writeText(CURRENT, oversized("a"))
    failNext("moveFile", CURRENT)
    failNext("unlink", CURRENT, new Error("unlink failed"))

    await launch().startSdkLogger()
    sdkWrites("fresh")

    expect(readText(CURRENT)?.endsWith("fresh\n")).toBe(true)
    expect(mockRecordErrorOnce).toHaveBeenLastCalledWith(
      "sdk-log-rotate",
      expect.objectContaining({ message: "unlink failed" }),
      { expected: true },
    )
  })

  it("logs without a file when the directory cannot be created", async () => {
    failNext("mkdir", DIR, new Error("read-only"))

    await launch().startSdkLogger()
    sdkWrites("nowhere")

    expect(loggerStarts()).toBe(1)
    expect(hasPath(CURRENT)).toBe(false)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-mkdir",
      expect.objectContaining({ message: "read-only" }),
      { expected: true },
    )
  })

  it("does not retry when it already started without a file", async () => {
    failNext("mkdir", DIR)
    failNext("initLogging", "", new Error("already initialised"))

    await expect(launch().startSdkLogger()).resolves.toBeUndefined()

    expect(loggerStarts()).toBe(0)
    expect(mockRecordErrorOnce).not.toHaveBeenCalledWith(
      "sdk-log-file-init",
      expect.anything(),
    )
  })

  it("retries without a file, and records it once, when the file cannot be opened", async () => {
    failNext("initLogging", DIR, new Error("Permission denied"))

    await launch().startSdkLogger()

    expect(loggerStarts()).toBe(1)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-file-init",
      expect.objectContaining({ message: "Permission denied" }),
    )
  })

  it("stays silent when the retry fails too, since the file was not the cause", async () => {
    failNext("initLogging", DIR)
    failNext("initLogging", "")

    await expect(launch().startSdkLogger()).resolves.toBeUndefined()

    expect(loggerStarts()).toBe(0)
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })
})

describe("resetSdkLogs", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDisk()
  })

  it("removes the logs, exports and its flag at once when no logger holds the file", async () => {
    makeDir(DIR)
    makeDir(EXPORTS)
    writeText(CURRENT, "wallet A\n")
    writeText(PREVIOUS, "wallet A older\n")
    writeText(`${EXPORTS}/blink-wallet-logs-x.txt`, "wallet A export")
    const logs = launch()

    await logs.resetSdkLogs()

    expect([CURRENT, PREVIOUS, EXPORTS, FLAG].some(hasPath)).toBe(false)
    await expect(logs.readSdkLogResetByte()).resolves.toBeUndefined()
  })

  it("leaves its flag for the next launch when it cannot finish the removal", async () => {
    makeDir(DIR)
    writeText(CURRENT, "wallet A\n")
    failNext("unlink", CURRENT, new Error("busy"))

    await launch().resetSdkLogs()

    expect(hasPath(FLAG)).toBe(true)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-reset",
      expect.objectContaining({ message: "busy" }),
      { expected: true },
    )
  })

  it("cuts off a file the running logger holds instead of orphaning it", async () => {
    writeText(PREVIOUS, "wallet A older\n")
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")

    await logs.resetSdkLogs()
    sdkWrites("wallet B")

    expect(hasPath(PREVIOUS)).toBe(false)
    expect(hasPath(FLAG)).toBe(true)
    expect(readText(CURRENT)).toBe("wallet A\nwallet B\n")
    await expect(logs.readSdkLogResetByte()).resolves.toBe("wallet A\n".length)
  })

  it("keeps the live file when sdk.log.1 can't be removed, leaving it to the next launch", async () => {
    writeText(PREVIOUS, "wallet A older\n")
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")
    failNext("unlink", PREVIOUS, new Error("busy"))

    await logs.resetSdkLogs()
    sdkWrites("wallet B")

    expect(readText(CURRENT)).toBe("wallet A\nwallet B\n")
    expect(hasPath(FLAG)).toBe(true)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-reset",
      expect.objectContaining({ message: "busy" }),
      { expected: true },
    )
  })

  it("removes the logs now when the flag cannot be written", async () => {
    writeText(PREVIOUS, "wallet A older\n")
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")
    failNext("writeFile", FLAG, new Error("disk full"))

    await logs.resetSdkLogs()

    expect([CURRENT, PREVIOUS, FLAG].some(hasPath)).toBe(false)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-reset-flag",
      expect.objectContaining({ message: "disk full" }),
      { expected: true },
    )
  })

  it("never removes the file a logger starting alongside it opens", async () => {
    writeText(CURRENT, "wallet A\n")
    const logs = launch()

    // a reset that begins just before the logger starts (#4351 review 3, finding 3)
    const resetting = logs.resetSdkLogs()
    const starting = logs.startSdkLogger()
    await Promise.all([resetting, starting])
    sdkWrites("wallet B")

    expect(readText(CURRENT)).toBe("wallet B\n")
    expect(hasPath(FLAG)).toBe(false)
  })

  it("never removes the file when it lands while the logger is already starting", async () => {
    writeText(CURRENT, "wallet A\n")
    const logs = launch()

    const starting = logs.startSdkLogger()
    const resetting = logs.resetSdkLogs()
    await Promise.all([starting, resetting])
    sdkWrites("wallet B")

    expect(readText(CURRENT)?.endsWith("wallet B\n")).toBe(true)
    const exportable = readText(CURRENT)!.slice((await logs.readSdkLogResetByte()) ?? 0)
    expect(exportable).not.toContain("wallet A")
  })

  it("refuses, and exports nothing old, when it can neither flag the reset nor remove the logs", async () => {
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")
    failNext("writeFile", FLAG, new Error("disk full"))
    failNext("unlink", CURRENT, new Error("busy"))

    await expect(logs.resetSdkLogs()).rejects.toThrow(
      "neither marked for reset nor removed",
    )

    await expect(logs.readSdkLogResetByte()).resolves.toBe(Number.POSITIVE_INFINITY)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-reset-flag",
      expect.objectContaining({ message: "disk full" }),
      { expected: true },
    )
  })

  it("is not undone by a later launch-reset call in the same process (a remounted root)", async () => {
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")
    await logs.resetSdkLogs()

    await logs.finishPendingSdkLogReset()
    sdkWrites("wallet B")

    expect(readText(CURRENT)).toBe("wallet A\nwallet B\n")
    expect(hasPath(FLAG)).toBe(true)
  })

  it("reads nothing more this session when the deleted wallet's SDK didn't go idle in time", async () => {
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A")

    await logs.resetSdkLogs({ readNothingThisSession: true })
    sdkWrites("wallet A still writing")

    expect(hasPath(FLAG)).toBe(true)
    await expect(logs.readSdkLogResetByte()).resolves.toBe(Number.POSITIVE_INFINITY)
  })

  it("reads nothing more this session either when no logger held the file", async () => {
    makeDir(DIR)
    writeText(CURRENT, "wallet A\n")
    const logs = launch()

    await logs.resetSdkLogs({ readNothingThisSession: true })

    expect([CURRENT, FLAG].some(hasPath)).toBe(false)
    await expect(logs.readSdkLogResetByte()).resolves.toBe(Number.POSITIVE_INFINITY)
  })

  it("does nothing lasting when there are no logs", async () => {
    await launch().resetSdkLogs()

    expect([CURRENT, PREVIOUS, FLAG].some(hasPath)).toBe(false)
    expect(mockRecordErrorOnce).not.toHaveBeenCalled()
  })
})

describe("the next launch after a reset", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    resetDisk()
  })

  const resetWhileLogging = async (afterReset: string[] = []) => {
    writeText(PREVIOUS, "wallet A older\n")
    const logs = launch()
    await logs.startSdkLogger()
    sdkWrites("wallet A paid 1000 sats")
    await logs.resetSdkLogs()
    afterReset.forEach(sdkWrites)
    endProcess()
  }

  it("removes the logs and the flag at launch even if no wallet connects", async () => {
    await resetWhileLogging(["wallet B restored"])

    await launch().finishPendingSdkLogReset()

    expect([CURRENT, PREVIOUS, FLAG].some(hasPath)).toBe(false)
    expect(loggerStarts()).toBe(1)
  })

  it("finishes the reset before the logger opens the file again", async () => {
    await resetWhileLogging(["wallet B restored"])

    await launch().startSdkLogger()
    sdkWrites("next session")

    expect(readText(CURRENT)).toBe("next session\n")
    expect(hasPath(FLAG)).toBe(false)
  })

  it("runs the launch reset once, however many callers ask for it", async () => {
    await resetWhileLogging()
    const logs = launch()

    await Promise.all([logs.finishPendingSdkLogReset(), logs.startSdkLogger()])
    sdkWrites("next session")
    await logs.finishPendingSdkLogReset()

    expect(readText(CURRENT)).toBe("next session\n")
  })

  it("reads nothing while an earlier reset is unfinished", async () => {
    await resetWhileLogging(["wallet B restored"])

    await expect(launch().readSdkLogResetByte()).resolves.toBe(Number.POSITIVE_INFINITY)
  })

  it("counts a flag by its existence, so a torn write still resets everything", async () => {
    await resetWhileLogging(["wallet B restored"])
    writeText(FLAG, "")

    await launch().finishPendingSdkLogReset()

    expect([CURRENT, PREVIOUS, FLAG].some(hasPath)).toBe(false)
  })

  it("logs without a file, keeping the flag, when the reset can't finish", async () => {
    await resetWhileLogging()
    failNext("unlink", CURRENT, new Error("busy"))

    await launch().startSdkLogger()
    sdkWrites("nowhere")

    expect(readText(CURRENT)).toBe("wallet A paid 1000 sats\n")
    expect(hasPath(FLAG)).toBe(true)
    expect(mockRecordErrorOnce).toHaveBeenCalledWith(
      "sdk-log-reset",
      expect.objectContaining({ message: "busy" }),
      { expected: true },
    )
  })
})
