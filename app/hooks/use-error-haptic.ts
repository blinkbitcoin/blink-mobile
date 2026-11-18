import { useEffect, useRef } from "react"

import { haptics } from "@app/utils/haptics"

/**
 * One haptic per error, as it appears. Errors are told apart by identity: a re-render
 * holding the same error stays quiet, while an error that clears and comes back, or is
 * replaced by another, buzzes again.
 *
 * - `error`: the flow stopped, whether in a sheet or an inline error the screen can't fix
 * - `reject`: an inline error the sender fixes right here, such as an amount over balance
 *
 * Only for errors the sender caused. A load or background failure has nothing to act on,
 * so it stays silent.
 */
export const useErrorHaptic = (error: unknown, kind: "error" | "reject" = "error") => {
  const lastError = useRef<unknown>(undefined)

  useEffect(() => {
    const previous = lastError.current
    lastError.current = error
    if (!error || Object.is(error, previous)) return
    haptics[kind]()
  }, [error, kind])
}

/** `useErrorHaptic` as an element, for a screen that knows its error only past an early
 *  return. */
export const ErrorHaptic = ({
  error,
  kind,
}: {
  error: unknown
  kind?: "error" | "reject"
}) => {
  useErrorHaptic(error, kind)
  return null
}
