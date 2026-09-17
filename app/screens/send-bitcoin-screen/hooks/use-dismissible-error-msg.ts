import { useCallback, useEffect, useState } from "react"

/**
 * An error message sheet's visibility: shown while there is a message, until
 * the user dismisses it. Dismissed stays dismissed for as long as the message
 * holds, and a new one after it clears opens the sheet again.
 */
export const useDismissibleErrorMsg = (message: string | undefined) => {
  const [isDismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!message) setDismissed(false)
  }, [message])

  const dismiss = useCallback(() => setDismissed(true), [])

  return { message, isVisible: Boolean(message) && !isDismissed, dismiss }
}
