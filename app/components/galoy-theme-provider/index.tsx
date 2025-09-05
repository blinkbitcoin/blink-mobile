import * as React from "react"
import { Appearance } from "react-native"

import { useColorSchemeQuery } from "@app/graphql/generated"
import theme from "@app/rne-theme/theme"
import { ThemeMode, ThemeProvider } from "@rn-vui/themed"

export const GaloyThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const data = useColorSchemeQuery()

  const colorScheme = data?.data?.colorScheme
  let mode: ThemeMode = "light"
  if (colorScheme === "system" || !colorScheme) {
    const systemScheme = Appearance.getColorScheme()
    if (systemScheme) {
      mode = systemScheme
    }
  } else {
    mode = colorScheme as ThemeMode
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
