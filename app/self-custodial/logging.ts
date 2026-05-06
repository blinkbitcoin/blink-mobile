import crashlytics from "@react-native-firebase/crashlytics"

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

type SdkLogListener = {
  addEventListener: (listener: {
    onEvent: (event: { level: string; line: string }) => void
  }) => Promise<string>
}

export const connectToSdkLogger = (sdk: SdkLogListener): Promise<string> =>
  sdk.addEventListener({
    onEvent: (event) => {
      logSdkEvent(toSdkLogLevel(event.level), event.line)
    },
  })
