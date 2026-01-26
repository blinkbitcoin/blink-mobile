import * as React from "react"
import { Linking, View } from "react-native"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ListItem, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"

import { SettingsGroup } from "./group"

type ApiItem = {
  id: string
  title: string
  leftIcon: IconNamesType
  rightIcon: IconNamesType
  link: string
  infoIcon?: IconNamesType
}

type ThemeColors = ReturnType<typeof useTheme>["theme"]["colors"]

type ApiItemRowProps = {
  colors: ThemeColors
  item: ApiItem
  onPress: (item: ApiItem) => void
  styles: ReturnType<typeof useStyles>
}

const DASHBOARD_LINK = "https://dashboard.blink.sv"

const ApiItemRow: React.FC<ApiItemRowProps> = ({ colors, item, onPress, styles }) => (
  <ListItem containerStyle={styles.listItemContainer} onPress={() => onPress(item)}>
    <View style={styles.iconContainer}>
      <GaloyIcon name={item.leftIcon} size={24} color={colors.grey0} />
    </View>
    <ListItem.Content>
      <ListItem.Title style={styles.itemTitle}>
        <View style={styles.listContent}>
          <Text type="p2">{item.title}</Text>
          {item.infoIcon && (
            <GaloyIcon name={item.infoIcon} size={18} color={colors.black} />
          )}
        </View>
      </ListItem.Title>
    </ListItem.Content>
    <GaloyIcon name={item.rightIcon} size={24} color={colors.warning} />
  </ListItem>
)
ApiItemRow.displayName = "ApiItemRow"

export const ApiScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const apiItems: ApiItem[] = [
    {
      id: "documentation",
      title: LL.SettingsScreen.apiDocumentation(),
      leftIcon: "document-outline",
      rightIcon: "link",
      link: DASHBOARD_LINK,
    },
    {
      id: "dashboard",
      title: LL.SettingsScreen.apiDashboard(),
      leftIcon: "house-outline",
      rightIcon: "link",
      link: DASHBOARD_LINK,
      infoIcon: "question",
    },
  ]

  const handleItemPress = (item: ApiItem) => {
    Linking.openURL(item.link)
  }

  const apiSettings = apiItems.map((item) => {
    const ApiItemRowWithItem: React.FC = () => (
      <ApiItemRow colors={colors} item={item} onPress={handleItemPress} styles={styles} />
    )
    ApiItemRowWithItem.displayName = `ApiItemRow-${item.id}`
    return ApiItemRowWithItem
  })

  return (
    <Screen style={styles.container} preset="scroll">
      <SettingsGroup items={apiSettings} />
    </Screen>
  )
}

const useStyles = makeStyles((theme) => ({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 20,
  },
  listItemContainer: {
    backgroundColor: theme.colors.transparent,
  },
  iconContainer: {
    marginRight: 12,
  },
  itemTitle: {
    fontSize: 16,
  },
  listContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
}))
