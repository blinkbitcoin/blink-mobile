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
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useAppConfig, useClipboard } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import { AccountType } from "@app/types/wallet"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme, Skeleton } from "@rn-vui/themed"

export const AccountBanner: React.FC = () => {
  const { activeAccount } = useAccountRegistry()

  if (activeAccount?.type === AccountType.SelfCustodial) {
    return <SelfCustodialAccountBanner />
  }
  return <CustodialAccountBanner />
}

const CustodialAccountBanner: React.FC = () => {
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
  const isAuthed = useIsAuthed()

  const { data, loading } = useSettingsScreenQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-first",
  })

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
        <View style={styles.iconContainer}>
          <AccountIcon size={25} />
        </View>
        <Text type="p2">
          {isUserLoggedIn ? usernameTitle : LL.SettingsScreen.logInOrCreateAccount()}
        </Text>
      </View>
    </TouchableWithoutFeedback>
  )
}

const SelfCustodialAccountBanner: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { lightningAddress } = useSelfCustodialWallet()
  const { copyToClipboard } = useClipboard()

  if (!lightningAddress) return null

  const handleCopy = () =>
    copyToClipboard({
      content: lightningAddress,
      message: LL.GaloyAddressScreen.copiedLightningAddressToClipboard(),
    })

  return (
    <TouchableOpacity onPress={handleCopy} style={styles.outer}>
      <View style={styles.iconContainer}>
        <AccountIcon size={25} />
      </View>
      <View style={styles.textContainer}>
        <Text type="p2" numberOfLines={1} ellipsizeMode="middle">
          {lightningAddress}
        </Text>
        <Text type="p3" style={styles.subtitle}>
          {LL.SettingsScreen.nonCustodialAccount()}
        </Text>
      </View>
      <GaloyIcon name="copy-paste" size={20} color={colors.primary} />
    </TouchableOpacity>
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
  textContainer: {
    flex: 1,
    flexDirection: "column",
  },
  subtitle: {
    color: theme.colors.grey2,
  },
}))
