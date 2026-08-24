import { RecordAppErrorOptions, recordAppError } from "@app/utils/error-reporting"

/** The message keeps scoping non-Error throws, so a bare string never reaches the dashboard
 *  unlabelled. `operation` now also travels in the options, which is the only way an `Error`
 *  carries its flow: wrapping one to get the label into the message would replace its stack
 *  with this file's, identical for every caller. */
export const reportError = (
  operation: string,
  err: unknown,
  options?: RecordAppErrorOptions,
): void => {
  const wrapped =
    err instanceof Error ? err : new Error(`${operation} failed: ${String(err)}`)
  recordAppError(wrapped, { ...options, operation })
}
