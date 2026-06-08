import crashlytics from "@react-native-firebase/crashlytics"

type LogErrorArgs = {
  scope: string
  error: unknown
  context?: Record<string, unknown>
}

const formatError = (error: unknown): Error =>
  error instanceof Error
    ? error
    : new Error(typeof error === "string" ? error : JSON.stringify(error))

export const logError = ({ scope, error, context }: LogErrorArgs): void => {
  const formatted = formatError(error)
  formatted.message = `[${scope}] ${formatted.message}`
  crashlytics().recordError(formatted)
  if (__DEV__) {
    console.error(`[${scope}]`, error, context ?? "")
  }
}
