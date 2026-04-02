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
  sdkLogLevelMap[level.toLowerCase()] ?? SdkLogLevel.Error

export const logSdkEvent = (level: SdkLogLevel, message: string): void => {
  const prefixed = `${LOG_PREFIX} ${message}`

  if (level === SdkLogLevel.Debug) {
    console.debug(prefixed)
    return
  }

  if (level === SdkLogLevel.Info) {
    console.debug(prefixed)
    crashlytics().log(prefixed)
    return
  }

  if (level === SdkLogLevel.Warn) {
    console.warn(prefixed)
    crashlytics().log(prefixed)
    return
  }

  console.error(prefixed)
  crashlytics().recordError(new Error(prefixed))
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
