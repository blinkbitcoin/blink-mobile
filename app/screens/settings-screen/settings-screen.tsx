import { ScrollView } from "react-native-gesture-handler"
import React, { useEffect } from "react"
import { TouchableOpacity } from "react-native"

import { gql } from "@apollo/client"
import { makeStyles, Text } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useBackupNudgeState } from "@app/hooks/use-backup-nudge-state"
import { Screen } from "@app/components/screen"
import { SettingsCard } from "./settings-card"
import { useI18nContext } from "@app/i18n/i18n-react"
import { VersionComponent } from "@app/components/version"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useUnacknowledgedNotificationCountQuery } from "@app/graphql/generated"

import { AccountBanner } from "./account/banner"
import { EmailSetting } from "./account/settings/email"
import { PhoneSetting } from "./account/settings/phone"
import { SettingsGroup } from "./group"
import { DefaultWallet } from "./settings/account-default-wallet"
import { AccountLevelSetting } from "./settings/account-level"
import { AccountLNAddress } from "./settings/account-ln-address"
import { PhoneLnAddress } from "./settings/phone-ln-address"
import { AccountPOS } from "./settings/account-pos"
import { TxLimits } from "./settings/account-tx-limits"
import { ApiAccessSetting } from "./settings/advanced-api-access"
import { ExportCsvSetting } from "./settings/advanced-export-csv"
import { JoinCommunitySetting } from "./settings/community-join"
import { NeedHelpSetting } from "./settings/community-need-help"
import { CurrencySetting } from "./settings/preferences-currency"
import { LanguageSetting } from "./settings/preferences-language"
import { ThemeSetting } from "./settings/preferences-theme"
import { NotificationSetting } from "./settings/sp-notifications"
import { OnDeviceSecuritySetting } from "./settings/sp-security"
import { TotpSetting } from "./totp"
import { AccountStaticQR } from "./settings/account-static-qr"
import { MoveToNonCustodialSetting } from "./settings/account-move-to-noncustodial"
import { SwitchAccountSetting } from "./settings/multi-account"
import { StableBalanceSetting } from "./settings/stable-balance"
import { ViewBackupPhraseSetting } from "./settings/view-backup-phrase"

// All queries in settings have to be set here so that the server is not hit with
// multiple requests for each query
gql`
  query UnacknowledgedNotificationCount {
    me {
      id
      unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount
    }
  }

  query SettingsScreen {
    me {
      id
      username
      language
      defaultAccount {
        id
        defaultWalletId
        wallets {
          id
          balance
          walletCurrency
        }
      }

      # Authentication Stuff needed for account screen
      totpEnabled
      phone
      email {
        address
        verified
      }
    }
  }
`

export const SettingsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()

  const isAuthed = useIsAuthed()
  const { isAtLeastLevelOne } = useLevel()
  const { shouldShowSettingsBanner } = useBackupNudgeState()
  const { data: unackNotificationCount } = useUnacknowledgedNotificationCountQuery({
    skip: !isAuthed,
    fetchPolicy: "cache-and-network",
  })

  const items = {
    account: [
      AccountLevelSetting,
      TxLimits,
      SwitchAccountSetting,
      MoveToNonCustodialSetting,
    ],
    waysToGetPaid: [AccountLNAddress, PhoneLnAddress, AccountPOS, AccountStaticQR],
    loginMethods: [EmailSetting, PhoneSetting],
    preferences: [
      NotificationSetting,
      DefaultWallet,
      CurrencySetting,
      LanguageSetting,
      ThemeSetting,
      StableBalanceSetting,
    ],
    securityAndPrivacy: [TotpSetting, OnDeviceSecuritySetting],
    recoveryMethod: [ViewBackupPhraseSetting],
    advanced: [ExportCsvSetting, ApiAccessSetting],
    community: [NeedHelpSetting, JoinCommunitySetting],
  }

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  useEffect(() => {
    const count =
      unackNotificationCount?.me
        ?.unacknowledgedStatefulNotificationsWithoutBulletinEnabledCount || 0
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate("notificationHistory")}>
          <GaloyIcon name="bell" size={24} style={styles.headerRight} />
          {count !== 0 && (
            <Text
              type="p4"
              style={styles.notificationCount}
              testID="notification-badge"
            />
          )}
        </TouchableOpacity>
      ),
    })
  }, [navigation, styles, unackNotificationCount])

  return (
    <Screen keyboardShouldPersistTaps="handled">
      <ScrollView contentContainerStyle={styles.outer}>
        <AccountBanner />
        {shouldShowSettingsBanner && (
          <SettingsCard
            title={LL.BackupNudge.title()}
            description={LL.BackupNudge.settingsWarning()}
            onPress={() => navigation.navigate("sparkBackupMethodScreen")}
            borderColor="primary"
            titleColor="primary"
          />
        )}
        <SettingsGroup name={LL.common.account()} items={items.account} />
        <SettingsGroup
          name={LL.SettingsScreen.addressScreen()}
          items={items.waysToGetPaid}
        />
        {isAtLeastLevelOne && (
          <SettingsGroup
            name={LL.AccountScreen.loginMethods()}
            items={items.loginMethods}
          />
        )}
        <SettingsGroup name={LL.common.preferences()} items={items.preferences} />
        <SettingsGroup
          name={LL.common.securityAndPrivacy()}
          items={items.securityAndPrivacy}
        />
        <SettingsGroup
          name={LL.SettingsScreen.recoveryMethod()}
          items={items.recoveryMethod}
        />
        <SettingsGroup name={LL.common.advanced()} items={items.advanced} />
        <SettingsGroup name={LL.common.support()} items={items.community} />
        <VersionComponent />
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  outer: {
    marginTop: 5,
    paddingHorizontal: 12,
    paddingBottom: 20,
    display: "flex",
    flexDirection: "column",
    rowGap: 18,
  },
  headerRight: {
    marginRight: 12,
  },
  notificationCount: {
    position: "absolute",
    right: 9,
    top: -3,
    color: colors._darkGrey,
    backgroundColor: colors.black,
    textAlign: "center",
    verticalAlign: "middle",
    height: 14,
    width: 14,
    borderRadius: 9,
    overflow: "hidden",
  },
}))
