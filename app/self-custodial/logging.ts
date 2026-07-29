import crashlytics from "@react-native-firebase/crashlytics"

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

const logDispatch: Record<SdkLogLevel, (msg: string) => void> = {
  [SdkLogLevel.Debug]: (msg) => console.debug(msg),
  [SdkLogLevel.Info]: (msg) => {
    console.debug(msg)
    crashlytics().log(msg)
  },
  [SdkLogLevel.Warn]: (msg) => {
    console.warn(msg)
    crashlytics().log(msg)
  },
  [SdkLogLevel.Error]: (msg) => {
    console.error(msg)
    recordAppError(new Error(msg), { dedupKey: sdkErrorDedupKey(msg) })
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
