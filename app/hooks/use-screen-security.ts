import { useEffect } from "react"

import { useTheme } from "@rn-vui/themed"

import { enableScreenSecurity, disableScreenSecurity } from "@app/utils/screen-security"

export const useScreenSecurity = (): void => {
  const {
    theme: { colors },
  } = useTheme()

  useEffect(() => {
    enableScreenSecurity(colors.black)
    return () => {
      disableScreenSecurity()
    }
  }, [colors.black])
}
