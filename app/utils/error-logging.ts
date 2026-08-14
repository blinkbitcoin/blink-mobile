import { RecordAppErrorOptions, recordAppError } from "@app/utils/error-reporting"

export const reportError = (
  operation: string,
  err: unknown,
  options?: RecordAppErrorOptions,
): void => {
  const wrapped =
    err instanceof Error ? err : new Error(`${operation} failed: ${String(err)}`)
  recordAppError(wrapped, options)
}
