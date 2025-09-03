/**
 * This component is the top banner on the settings screen
 * It shows the user their own username with a people icon
 * If the user isn't logged in, it shows Login or Create Account
 * Later on, this will support switching between accounts
 */
import React from "react"
import { TouchableOpacity, View } from "react-native"
import { TouchableWithoutFeedback } from "react-native-gesture-handler"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme, Skeleton } from "@rneui/themed"
import { useAppConfig } from "@app/hooks"

export const AccountBanner: React.FC<{ showSwitchAccountIcon?: boolean }> = ({
  showSwitchAccountIcon = false,
}) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const { appConfig } = useAppConfig()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { currentLevel } = useLevel()
  const isUserLoggedIn = currentLevel !== AccountLevel.NonAuth

  const { data, loading } = useSettingsScreenQuery({ fetchPolicy: "cache-first" })

  const hasUsername = Boolean(data?.me?.username)
  const hostName = appConfig.galoyInstance.lnAddressHostname
  const lnAddress = `${data?.me?.username}@${hostName}`

  const usernameTitle = hasUsername ? lnAddress : LL.common.blinkUser()

  if (loading) return <Skeleton style={styles.outer} animation="pulse" />

  const handleSwitchPress = () => {
    navigation.navigate("profileScreen")
  }

  return (
    <TouchableWithoutFeedback
      onPress={() =>
        !isUserLoggedIn &&
        navigation.reset({
          index: 0,
          routes: [{ name: "getStarted" }],
        })
      }
    >
      <TouchableOpacity
        style={styles.switch}
        onPress={handleSwitchPress}
        activeOpacity={0.7}
      >
        <View style={styles.outer}>
          <View style={styles.iconContainer}>
            <AccountIcon size={22} />
          </View>
          <Text type="p2">
            {isUserLoggedIn ? usernameTitle : LL.SettingsScreen.logInOrCreateAccount()}
          </Text>
        </View>
        {isUserLoggedIn && showSwitchAccountIcon && (
          <GaloyIcon name="transfer" size={27} color={colors.primary} />
        )}
      </TouchableOpacity>
    </TouchableWithoutFeedback>
  )
}

export const AccountIcon: React.FC<{ size: number }> = ({ size }) => {
  const {
    theme: { colors },
  } = useTheme()
  return <GaloyIcon name="user" size={size} backgroundColor={colors.grey4} />
}

const useStyles = makeStyles((theme) => ({
  outer: {
    height: 70,
    padding: 4,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    columnGap: 12,
  },
  switch: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconContainer: {
    backgroundColor: theme.colors.grey4,
    borderRadius: 100,
    padding: 3,
  },
}))
