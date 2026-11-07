import { useCallback, useRef, useState } from "react"

/**
 * An error message sheet's visibility: shown while there is an error, until the user
 * dismisses it. Errors are told apart by identity, so a dismissed sheet stays closed
 * while the same error holds, and any new error opens it again, even with the same text.
 *
 * `shown` is the last error there was, so a sheet whose error has just cleared keeps its
 * content while it slides out.
 */
export const useDismissibleErrorMsg = <T extends object>(error: T | undefined) => {
  const [dismissedError, setDismissedError] = useState<T>()
  const lastError = useRef(error)
  if (error) lastError.current = error

  const dismiss = useCallback(() => setDismissedError(error), [error])

  return {
    error,
    shown: lastError.current,
    isVisible: Boolean(error) && error !== dismissedError,
    dismiss,
  }
}
