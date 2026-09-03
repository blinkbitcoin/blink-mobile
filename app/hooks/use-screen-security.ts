import { useEffect } from "react"

import { useTheme } from "@rn-vui/themed"

import { enableScreenSecurity, disableScreenSecurity } from "@app/utils/screen-security"
import { reportError } from "@app/utils/error-logging"

export const useScreenSecurity = (): void => {
  const {
    theme: { colors },
  } = useTheme()

  useEffect(() => {
    // The calls are fire-and-forget, so without the catch a native failure to install
    // the guard would surface only as an unhandled rejection while the screen renders
    // its seed words unprotected.
    enableScreenSecurity(colors.black).catch((err: unknown) =>
      reportError("Enable screen security", err),
    )
    return () => {
      disableScreenSecurity().catch((err: unknown) =>
        reportError("Disable screen security", err),
      )
    }
  }, [colors.black])
}
