import * as React from "react"
import { View, Linking } from "react-native"
import { makeStyles, Text, useTheme, Divider, ListItem } from "@rn-vui/themed"
import { GaloyIcon, IconNamesType } from "@app/components/atomic/galoy-icon"
import { Screen } from "../../components/screen"

type ApiItem = {
  id: string
  title: string
  leftIcon: IconNamesType
  rightIcon: IconNamesType
  action: "external" | "copy" | "info"
  link: string
  infoIcon?: IconNamesType
}

const DASHBOARD_LINK = "https://dashboard.blink.sv"

export const ApiScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const apiItems: ApiItem[] = [
    {
      id: "documentation",
      title: "API documentation",
      leftIcon: "document-outline",
      rightIcon: "link",
      action: "external",
      link: DASHBOARD_LINK,
    },
    {
      id: "dashboard",
      title: "API access and dashboard",
      leftIcon: "house-outline",
      rightIcon: "link",
      action: "external",
      link: DASHBOARD_LINK,
      infoIcon: "question",
    },
  ]

  const handleItemPress = (item: ApiItem) => {
    switch (item.action) {
      case "external":
        Linking.openURL(item.link)
        break
      case "copy":
        break
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.settingsBody}>
          {apiItems.map((item, index) => {
            const isLast = index === apiItems.length - 1
            return (
              <React.Fragment key={item.id}>
                <ListItem
                  containerStyle={styles.listItemContainer}
                  onPress={() => handleItemPress(item)}
                >
                  <View style={styles.iconContainer}>
                    <GaloyIcon name={item.leftIcon} size={24} color={colors.grey0} />
                  </View>
                  <ListItem.Content>
                    <ListItem.Title style={styles.itemTitle}>
                      <View style={styles.listContent}>
                        <Text type="p2">{item.title}</Text>
                        {item.infoIcon && (
                          <GaloyIcon
                            name={item.infoIcon}
                            size={18}
                            color={colors.black}
                          />
                        )}
                      </View>
                    </ListItem.Title>
                  </ListItem.Content>
                  <GaloyIcon name={item.rightIcon} size={24} color={colors.warning} />
                </ListItem>
                {!isLast && <Divider color={colors.grey4} />}
              </React.Fragment>
            )
          })}
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  preferencesText: {
    marginBottom: 12,
  },
  settingsBody: {
    backgroundColor: theme.colors.grey5,
    borderRadius: 12,
    overflow: "hidden",
  },
  listItemContainer: {
    backgroundColor: theme.colors.grey5,
    paddingVertical: 16,
    paddingHorizontal: 16,
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
