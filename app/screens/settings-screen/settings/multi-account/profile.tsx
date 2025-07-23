import React, { useState } from "react"
import { ActivityIndicator, Alert } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { ListItem, Avatar, Overlay, Text, makeStyles } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon/galoy-icon"
import { GaloyIconButton } from "@app/components/atomic/galoy-icon-button/galoy-icon-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import useLogout from "@app/hooks/use-logout"
import { useAppConfig } from "@app/hooks"

export const Profile: React.FC<ProfileProps> = ({
  identifier,
  token,
  selected,
  avatarUrl,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [logoutLoading, setLogoutLoading] = useState(false)
  const [switchLoading, setSwitchLoading] = useState(false)

  const { saveToken } = useAppConfig()
  const { logout } = useLogout()

  const handleLogout = () => {
    Alert.alert(
      LL.SettingsScreen.logoutOneAccountAlertTitle(),
      LL.SettingsScreen.logoutOneAccountAlertContent({ identifier }),
      [
        {
          text: LL.common.cancel(),
          style: "cancel",
        },
        {
          text: LL.SettingsScreen.logoutOneAccountConfirm(),
          onPress: async () => {
            setLogoutLoading(true)
            await logout({ stateToDefault: false, token })
            navigation.navigate("Primary")
            setLogoutLoading(false)
          },
        },
      ],
    )
  }

  const handleProfileSwitch = async () => {
    setSwitchLoading(true)
    await saveToken(token)
    setSwitchLoading(false)
    navigation.navigate("Primary")
  }

  return (
    <>
      <ListItem
        bottomDivider
        onPress={handleProfileSwitch}
        containerStyle={styles.listItem}
        style={selected && styles.listItemSelected}
      >
        {avatarUrl ? (
          <Avatar rounded source={{ uri: avatarUrl }} size={44} />
        ) : (
          <GaloyIcon name="user" size={30} backgroundColor={styles.iconColor.color} />
        )}
        <ListItem.Content>
          <ListItem.Title>{identifier}</ListItem.Title>
        </ListItem.Content>

        {selected === false &&
          (logoutLoading ? (
            <ActivityIndicator size="large" color={styles.loadingIconColor.color} />
          ) : (
            <GaloyIconButton
              name="close"
              size="medium"
              onPress={handleLogout}
              backgroundColor={styles.iconColor.color}
            />
          ))}
      </ListItem>

      <Overlay isVisible={switchLoading} overlayStyle={styles.overlayStyle}>
        <ActivityIndicator size={50} color={styles.loadingIconColor.color} />
        <Text>{LL.AccountScreen.pleaseWait()}</Text>
      </Overlay>
    </>
  )
}

export const useStyles = makeStyles(({ colors }) => ({
  listItem: {
    backgroundColor: colors.grey4,
    borderBottomWidth: 1,
    borderBottomColor: colors.grey3,
  },
  listItemSelected: {
    borderLeftWidth: 5,
    borderLeftColor: colors.primary,
  },
  iconColor: {
    color: colors.grey5,
  },
  loadingIconColor: {
    color: colors.primary,
  },
  overlayStyle: {
    backgroundColor: "transparent",
    shadowColor: "transparent",
  },
}))
