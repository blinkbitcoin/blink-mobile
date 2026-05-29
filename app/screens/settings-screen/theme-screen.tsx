import * as React from "react"
import { View } from "react-native"

import { GaloyInfo } from "@app/components/atomic/galoy-info"
import { MenuSelect, MenuSelectItem } from "@app/components/menu-select"
import { useEffectiveTheme } from "@app/hooks/use-effective-theme"
import { useI18nContext } from "@app/i18n/i18n-react"
import { type ThemePreference } from "@app/store/persistent-state/theme-preference"
import { makeStyles } from "@rn-vui/themed"

import { Screen } from "../../components/screen"

const useStyles = makeStyles(() => ({
  container: {
    padding: 10,
  },
  info: {
    marginTop: 20,
  },
}))

export const ThemeScreen: React.FC = () => {
  const { theme, setTheme } = useEffectiveTheme()

  const { LL } = useI18nContext()
  const styles = useStyles()

  const Themes: { id: ThemePreference; text: string }[] = [
    {
      id: "system",
      text: LL.ThemeScreen.system(),
    },
    {
      id: "light",
      text: LL.ThemeScreen.light(),
    },
    {
      id: "dark",
      text: LL.ThemeScreen.dark(),
    },
  ]

  return (
    <Screen style={styles.container} preset="scroll">
      <MenuSelect
        value={theme}
        onChange={async (value) => setTheme(value as ThemePreference)}
      >
        {Themes.map(({ id, text }) => (
          <MenuSelectItem key={id} value={id}>
            {text}
          </MenuSelectItem>
        ))}
      </MenuSelect>
      <View style={styles.info}>
        <GaloyInfo>{LL.ThemeScreen.info()}</GaloyInfo>
      </View>
    </Screen>
  )
}
