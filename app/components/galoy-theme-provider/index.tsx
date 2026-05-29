import * as React from "react"
import { Appearance } from "react-native"

import { useEffectiveTheme } from "@app/hooks/use-effective-theme"
import theme from "@app/rne-theme/theme"
import { ThemeMode, ThemeProvider } from "@rn-vui/themed"

export const GaloyThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { theme: themePreference } = useEffectiveTheme()

  let mode: ThemeMode = "light"
  if (themePreference === "system") {
    const systemScheme = Appearance.getColorScheme()
    if (systemScheme && systemScheme !== "unspecified") {
      mode = systemScheme
    }
  } else {
    mode = themePreference
  }

  return (
    <ThemeProvider
      theme={{
        ...theme,
        mode,
      }}
    >
      {children}
    </ThemeProvider>
  )
}
