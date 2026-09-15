import crashlytics from "@react-native-firebase/crashlytics"

import { mayTransmitDiagnostics } from "@app/telemetry"
import { RecordAppErrorOptions, recordAppError } from "@app/utils/error-reporting"

export const recordErrorOnce = (
  dedupKey: string,
  error: Error,
  options?: Pick<RecordAppErrorOptions, "expected">,
): void => recordAppError(error, { dedupKey, ...options })

export const SdkLogLevel = {
  Debug: "debug",
  Info: "info",
  Warn: "warn",
  Error: "error",
} as const

export type SdkLogLevel = (typeof SdkLogLevel)[keyof typeof SdkLogLevel]

const LOG_PREFIX = "[SparkSDK]"

const sdkLogLevelMap: Record<string, SdkLogLevel> = {
  debug: SdkLogLevel.Debug,
  info: SdkLogLevel.Info,
  warn: SdkLogLevel.Warn,
  error: SdkLogLevel.Error,
}

const toSdkLogLevel = (level: string): SdkLogLevel =>
  sdkLogLevelMap[level.toLowerCase()] ?? SdkLogLevel.Info

// SDK retry loops repeat the same line with varying counters/ports; normalize digits
// so each distinct message shape records at most one non-fatal per session.
const sdkErrorDedupKey = (msg: string): string => msg.replace(/\d+/g, "#").slice(0, 200)

/**
 * SDK log lines leave the device only from a `Custodial` or `Enhanced` one (AD-13, ruled
 * onto this file by AD-30). An SDK line routinely carries payment ids and amounts, and a
 * Crashlytics breadcrumb or non-fatal is a transmission with a device-stable installation
 * id on it — from an `Anon` or `Unresolved` device that is the telemetry NFR-P1 says must
 * be zero, whatever product sends it. The console still gets everything, so a device in
 * hand can be debugged; what changes is what a device out of hand sends home.
 */
const logDispatch: Record<SdkLogLevel, (msg: string) => void> = {
  [SdkLogLevel.Debug]: (msg) => console.debug(msg),
  [SdkLogLevel.Info]: (msg) => {
    console.debug(msg)
    if (mayTransmitDiagnostics()) crashlytics().log(msg)
  },
  [SdkLogLevel.Warn]: (msg) => {
    console.warn(msg)
    if (mayTransmitDiagnostics()) crashlytics().log(msg)
  },
  [SdkLogLevel.Error]: (msg) => {
    console.error(msg)
    if (mayTransmitDiagnostics()) {
      recordAppError(new Error(msg), { dedupKey: sdkErrorDedupKey(msg) })
    }
  },
}

export const logSdkEvent = (level: SdkLogLevel, message: string): void => {
  logDispatch[level](`${LOG_PREFIX} ${message}`)
}

type LogEntry = {
  level: string
  line: string
}

const SUPPRESSED_MESSAGES = ["Received empty event"]

export const createSdkLogListener = () => ({
  log: (entry: LogEntry) => {
    if (SUPPRESSED_MESSAGES.some((m) => entry.line.includes(m))) return
    logSdkEvent(toSdkLogLevel(entry.level), entry.line)
  },
})
