import * as React from "react"

/**
 * The code the e-sign library words as a lost connection. Offline is a status of its
 * own there, not an error, so it carries no code; this is the one whose copy a step
 * borrows when what it waits on, the price feed or the account, has been silent for
 * longer than a connected device would be.
 */
export const LOST_CONNECTION_CODE = "NETWORK_ERROR"

/**
 * How long a step waits before it stops waiting and says so. A spinner with no end and
 * no button is a dead end; something the device should already have that has not
 * arrived in this long means it is most likely offline.
 */
export const WAIT_TIMEOUT_MS = 15_000

/**
 * Whether a wait has gone on too long. While `isWaiting` holds a timer runs; once it
 * drops, the flag drops with it so a later wait starts fresh. `startOver` drops it
 * too, which starts the timer over: what is waited on arrives on its own once the
 * device is back, so nothing else has to be tapped.
 */
export const useGivenUpWaiting = (
  isWaiting: boolean,
): { hasGivenUp: boolean; startOver: () => void } => {
  const [hasGivenUp, setHasGivenUp] = React.useState(false)

  React.useEffect(() => {
    if (!isWaiting) {
      setHasGivenUp(false)
      return
    }
    if (hasGivenUp) return
    const giveUp = setTimeout(() => setHasGivenUp(true), WAIT_TIMEOUT_MS)
    return () => clearTimeout(giveUp)
  }, [isWaiting, hasGivenUp])

  const startOver = React.useCallback(() => setHasGivenUp(false), [])

  return { hasGivenUp, startOver }
}
