import { recordAppError, toError } from "@app/utils/error-reporting"

type LogErrorArgs = {
  scope: string
  error: unknown
  context?: Record<string, unknown>
  expected?: boolean
  dedupKey?: string
}

export const logError = ({
  scope,
  error,
  context,
  expected,
  dedupKey,
}: LogErrorArgs): void => {
  const formatted = toError(error)
  formatted.message = `[${scope}] ${formatted.message}`
  recordAppError(formatted, { expected, dedupKey })
  if (__DEV__) {
    console.error(`[${scope}]`, error, context ?? "")
  }
}
