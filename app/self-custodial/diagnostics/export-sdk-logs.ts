import RNFS from "react-native-fs"

import { SDK_LOG_EXPORT_BYTES, sdkLogDir, sdkLogExportDir } from "../config"

import { buildSdkLogExport, type SdkLogPart } from "./build-sdk-log-export"
import { SDK_LOG_FILE, SDK_LOG_FILE_PREVIOUS, readSdkLogResetByte } from "./sdk-log-files"

export const SDK_LOG_EXPORT_BASENAME = "blink-wallet-logs"

const NEWLINE = 0x0a

type LogTail = SdkLogPart & { bytes: number }

/**
 * Reads up to the last `maxBytes` of a log, never before byte `from`. A read that starts
 * mid-line can split a UTF-8 character, which RNFS's own utf8 decoding throws on; so read
 * the range as base64 and start after its first newline, a byte no multi-byte character
 * contains. A read starting exactly at `from` starts on a line. A large file is never
 * loaded whole.
 */
const readLogTail = async ({
  path,
  name,
  maxBytes,
  from = 0,
}: {
  path: string
  name: string
  maxBytes: number
  from?: number
}): Promise<LogTail | null> => {
  if (maxBytes <= 0 || !(await RNFS.exists(path))) return null
  const { size } = await RNFS.stat(path)
  if (size <= from) return null

  const length = Math.min(size - from, maxBytes)
  const position = size - length
  let bytes = Buffer.from(await RNFS.read(path, length, position, "base64"), "base64")
  if (position > from) {
    const firstNewline = bytes.indexOf(NEWLINE)
    bytes =
      firstNewline === -1
        ? bytes.subarray(bytes.length)
        : bytes.subarray(firstNewline + 1)
  }
  if (bytes.length === 0) return null
  return { name, text: bytes.toString("utf8"), bytes: length }
}

const pad = (value: number): string => String(value).padStart(2, "0")

const exportStamp = (now: Date): string =>
  `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}-` +
  `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}`

/**
 * Builds the export file from both log generations, newest bytes first within the cap,
 * and returns its path; null when there is nothing to share (the SDK has not run on this
 * install yet, or the logs were reset). After a wallet was deleted in this process only
 * what `sdk.log` gained since is read, and never `sdk.log.1`. A previous export is removed
 * first instead of after sharing: some share targets read the file after the sheet has
 * closed.
 */
export const exportSdkLogs = async (
  header: string,
  now: Date,
): Promise<string | null> => {
  const dir = sdkLogDir()
  const resetAtByte = await readSdkLogResetByte()
  const current = await readLogTail({
    path: `${dir}/${SDK_LOG_FILE}`,
    name: SDK_LOG_FILE,
    maxBytes: SDK_LOG_EXPORT_BYTES,
    from: resetAtByte,
  })
  const previous =
    resetAtByte === undefined
      ? await readLogTail({
          path: `${dir}/${SDK_LOG_FILE_PREVIOUS}`,
          name: SDK_LOG_FILE_PREVIOUS,
          maxBytes: SDK_LOG_EXPORT_BYTES - (current?.bytes ?? 0),
        })
      : null
  const parts = [previous, current].filter((part): part is LogTail => part !== null)
  if (parts.length === 0) return null

  const exportDir = sdkLogExportDir()
  if (await RNFS.exists(exportDir)) await RNFS.unlink(exportDir)
  await RNFS.mkdir(exportDir)

  const path = `${exportDir}/${SDK_LOG_EXPORT_BASENAME}-${exportStamp(now)}.txt`
  await RNFS.writeFile(path, buildSdkLogExport({ header, parts }), "utf8")
  return path
}
