import crashlytics from "@react-native-firebase/crashlytics"

const reportedDedupKeys = new Set<string>()

export const recordErrorOnce = (dedupKey: string, error: Error): void => {
  if (reportedDedupKeys.has(dedupKey)) return
  reportedDedupKeys.add(dedupKey)
  crashlytics().recordError(error)
}

// Test-only escape hatch so specs that mount/unmount the SC stack repeatedly
// (or swap envs across `jest.isolateModules` boundaries) don't see one test's
// dedup state poisoning the next.
export const __resetRecordedErrorsForTests = (): void => {
  reportedDedupKeys.clear()
}

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
    crashlytics().recordError(new Error(msg))
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
