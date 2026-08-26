import { useEffect, useState } from "react"

import { useTheme } from "@rn-vui/themed"

import { acquireScreenSecurity } from "@app/utils/screen-security"
import { reportError } from "@app/utils/error-logging"

export type ScreenSecurityState = "activating" | "active" | "failed"

/** Owns one screen-security lease for the mount lifetime and exposes where the
 *  guard stands, so the caller can keep sensitive content unmounted until the
 *  guard is actually on — painting first and registering behind it would leave
 *  the seed words capturable for the whole registration window. */
export const useScreenSecurity = (): ScreenSecurityState => {
  const {
    theme: { colors },
  } = useTheme()
  const [state, setState] = useState<ScreenSecurityState>("activating")

  useEffect(() => {
    // A theme flip re-runs this effect: the cleanup releases the only lease and
    // the guard drops before the fresh registration lands. Reset to
    // "activating" so the gate re-hides the content for that window instead of
    // leaving it mounted behind a guard that is momentarily off.
    setState("activating")
    const lease = acquireScreenSecurity(colors.black)
    let mounted = true

    lease.ready.then(
      () => {
        if (mounted) setState("active")
      },
      (error: unknown) => {
        reportError("Enable screen security", error)
        if (mounted) setState("failed")
      },
    )

    return () => {
      // Late settlement must not reach a state update after unmount, and the
      // lease releases exactly once no matter how the effect is torn down.
      mounted = false
      lease
        .release()
        .catch((error: unknown) => reportError("Disable screen security", error))
    }
  }, [colors.black])

  return state
}
