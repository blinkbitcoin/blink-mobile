import crashlytics from "@react-native-firebase/crashlytics"

export const reportError = (operation: string, err: unknown): void => {
  const wrapped =
    err instanceof Error ? err : new Error(`${operation} failed: ${String(err)}`)
  crashlytics().recordError(wrapped)
}
