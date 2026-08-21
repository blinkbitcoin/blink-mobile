/**
 * This component is the top banner on the settings screen
 * It shows the user their own username with a people icon
 * If the user isn't logged in, it shows Login or Create Account
 * Later on, this will support switching between accounts
 */
import React from "react"
import { View } from "react-native"

import { TouchableWithoutFeedback } from "react-native-gesture-handler"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, Skeleton, Avatar } from "@rn-vui/themed"

import { useSettingsScreenQuery } from "@app/graphql/generated"
import { AccountLevel, useLevel } from "@app/graphql/level-context"
import { useAppConfig } from "@app/hooks"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useLightningAddressGated } from "@app/self-custodial/hooks/use-lightning-address-gate"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { AccountType } from "@app/types/wallet"

export const AccountBannerVertical: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const {
    appConfig: {
      galoyInstance: { lnAddressHostname },
    },
  } = useAppConfig()

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { currentLevel } = useLevel()
  const { activeAccount } = useAccountRegistry()
  const { lightningAddress: selfCustodialLightningAddress } = useSelfCustodialWallet()
  const isLightningAddressGated = useLightningAddressGated()
  const isSelfCustodial = activeAccount?.type === AccountType.SelfCustodial
  const isUserLoggedIn = currentLevel !== AccountLevel.NonAuth

  const { data, loading } = useSettingsScreenQuery({
    fetchPolicy: "cache-first",
    skip: isSelfCustodial,
  })

  const hasUsername = Boolean(data?.me?.username)
  const custodialLnAddress = `${data?.me?.username}@${lnAddressHostname}`

  if (loading) return <Skeleton style={styles.outer} animation="pulse" />

  if (isSelfCustodial) {
    const subtitle = LL.SettingsScreen.nonCustodialAccount()
    const avatarChar = (selfCustodialLightningAddress ?? subtitle).charAt(0)
    /** Labelled the same way as the settings row and the horizontal banner: an address
     *  the account cannot be paid at must not read as one that works. */
    const isAddressLabelledDisabled =
      Boolean(selfCustodialLightningAddress) && isLightningAddressGated
    const displayedAddress = isAddressLabelledDisabled
      ? `${selfCustodialLightningAddress} ${LL.SettingsScreen.addressDisabled()}`
      : selfCustodialLightningAddress
    return (
      <View style={styles.outer}>
        <Avatar
          size={80}
          rounded
          title={avatarChar}
          containerStyle={styles.containerStyle}
          titleStyle={styles.titleStyle}
        />
        <View style={styles.textContainer}>
          {selfCustodialLightningAddress ? (
            <Text type="p2">{displayedAddress}</Text>
          ) : null}
          <Text type="p2">{subtitle}</Text>
        </View>
      </View>
    )
  }

  const usernameTitle = hasUsername ? custodialLnAddress : LL.common.blinkUser()

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
