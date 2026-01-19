/**
 * This component is the top banner on the settings screen
 * It shows the user their own username with a people icon
 * If the user isn't logged in, it shows Login or Create Account
 * Later on, this will support switching between accounts
 */
import React from "react"
import { View } from "react-native"
import { TouchableWithoutFeedback } from "react-native-gesture-handler"

import { useSettingsScreenQuery } from "@app/graphql/generated"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, Skeleton, Avatar } from "@rn-vui/themed"
import { useAppConfig } from "@app/hooks"

export const AccountBannerVertical: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const { currentLevel } = useLevel()
  const isUserLoggedIn = currentLevel !== AccountLevel.NonAuth

  const { data, loading } = useSettingsScreenQuery({ fetchPolicy: "cache-first" })

  const hasUsername = Boolean(data?.me?.username)
  const lnAddress = `${data?.me?.username}@${lnAddressHostname}`

  const usernameTitle = hasUsername ? lnAddress : LL.common.blinkUser()

  if (loading) return <Skeleton style={styles.outer} animation="pulse" />

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
      <View style={styles.outer}>
        <Avatar
          size={80}
          rounded
          title={
            isUserLoggedIn
              ? usernameTitle.charAt(0)
              : LL.SettingsScreen.logInOrCreateAccount().charAt(0)
          }
          containerStyle={styles.containerStyle}
          titleStyle={styles.titleStyle}
        />
        <View style={styles.textContainer}>
          <Text type="p2">
            {isUserLoggedIn ? usernameTitle : LL.SettingsScreen.logInOrCreateAccount()}
          </Text>
          <Text type="p2">{LL.AccountScreen.level({ level: currentLevel })}</Text>
        </View>
      </View>
    </TouchableWithoutFeedback>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  outer: {
    padding: 4,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    rowGap: 15,
  },
  switch: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    rowGap: 1,
  },
  containerStyle: {
    backgroundColor: colors.grey5,
  },
  titleStyle: {
    color: colors.primary,
    fontWeight: "bold",
    fontSize: 50,
    includeFontPadding: false,
  },
}))
