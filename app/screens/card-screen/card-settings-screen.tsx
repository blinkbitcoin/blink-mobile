import React, { useState } from "react"
import { View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { Screen } from "@app/components/screen"
import { ContactSupportRow, SettingItemRow, SwitchRow } from "@app/components/card-screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { isIos } from "@app/utils/helper"

import { MOCK_CARD_PIN } from "./card-mock-data"

export const CardSettingsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const [transactionAlerts, setTransactionAlerts] = useState(true)
  const [securityAlerts, setSecurityAlerts] = useState(true)
  const [marketingUpdates, setMarketingUpdates] = useState(false)

  const handlePersonalDetails = () => {
    navigation.navigate("cardPersonalDetailsScreen")
  }

  const handleChangePin = () => {
    if (MOCK_CARD_PIN) {
      navigation.navigate("cardChangePinScreen")
      return
    }
    navigation.navigate("cardCreatePinScreen")
  }

  const handleOrderPhysicalCard = () => {
    console.log("Order physical card pressed")
  }

  const handleAddToMobileWallet = () => {
    navigation.navigate("cardAddToMobileWalletScreen")
  }

  const handleReplaceCard = () => {
    navigation.navigate("replaceCardScreen")
  }

  const handleContactSupport = () => {
    console.log("Contact support pressed")
  }

  const handleTermsAndConditions = () => {
    console.log("Terms and Conditions pressed")
  }

  const handlePrivacyPolicy = () => {
    console.log("Privacy Policy pressed")
  }

  const handleCloseCardAccount = () => {
    console.log("Close card account pressed")
  }

  return (
    <Screen preset="scroll">
      <View style={styles.container}>
        <SettingsGroup
          name={LL.common.accountInformation()}
          titleStyle={styles.sectionTitle}
          dividerStyle={styles.dividerStyle}
          items={[
            () => (
              <SettingItemRow
                title={LL.CardFlow.CardSettings.personalDetails()}
                leftIcon="user"
                onPress={handlePersonalDetails}
              />
            ),
            () => (
              <SettingItemRow
                title={
                  MOCK_CARD_PIN
                    ? LL.CardFlow.CardSettings.changePin()
                    : LL.CardFlow.PinScreens.CreateFlow.title()
                }
                leftIcon="key-outline"
                onPress={handleChangePin}
              />
            ),
          ]}
        />

        <View style={styles.notificationsSection}>
          <Text style={styles.sectionTitle}>{LL.common.notifications()}</Text>
          <SettingsGroup
            containerStyle={styles.settingsGroupContainer}
            dividerStyle={styles.dividerStyle}
            items={[
              () => (
                <SwitchRow
                  title={LL.CardFlow.CardSettings.transactionAlerts()}
                  description={LL.CardFlow.CardSettings.transactionAlertsDescription()}
                  value={transactionAlerts}
                  onValueChange={(value) => setTransactionAlerts(value)}
                />
              ),
              () => (
                <SwitchRow
                  title={LL.CardFlow.CardSettings.securityAlerts()}
                  description={LL.CardFlow.CardSettings.securityAlertsDescription()}
                  value={securityAlerts}
                  onValueChange={(value) => setSecurityAlerts(value)}
                />
              ),
              () => (
                <SwitchRow
                  title={LL.CardFlow.CardSettings.marketingUpdates()}
                  description={LL.CardFlow.CardSettings.marketingUpdatesDescription()}
                  value={marketingUpdates}
                  onValueChange={(value) => setMarketingUpdates(value)}
                />
              ),
            ]}
          />
        </View>

        <SettingsGroup
          name={LL.CardFlow.CardSettings.cardManagement()}
          titleStyle={styles.sectionTitle}
          dividerStyle={styles.dividerStyle}
          items={[
            () => (
              <SettingItemRow
                title={LL.CardFlow.CardSettings.orderPhysicalCard()}
                leftIcon="physical-card"
                onPress={handleOrderPhysicalCard}
              />
            ),
            () => (
              <SettingItemRow
                title={
                  isIos
                    ? LL.CardFlow.CardSettings.addToAppleWallet()
                    : LL.CardFlow.CardSettings.addToGooglePay()
                }
                leftIonicon="wallet-outline"
                onPress={handleAddToMobileWallet}
              />
            ),
            () => (
              <SettingItemRow
                title={LL.CardFlow.CardSettings.replaceCard()}
                leftIcon="refresh"
                onPress={handleReplaceCard}
              />
            ),
          ]}
        />

        <View style={styles.supportSection}>
          <Text style={styles.sectionTitle}>{LL.common.support()}</Text>
          <ContactSupportRow onPress={handleContactSupport} />
        </View>

        <SettingsGroup
          name={LL.common.account()}
          titleStyle={styles.sectionTitle}
          dividerStyle={styles.dividerStyle}
          items={[
            () => (
              <SettingItemRow
                title={LL.CardFlow.CardSettings.termsAndConditions()}
                leftIcon="document-outline"
                onPress={handleTermsAndConditions}
              />
            ),
            () => (
              <SettingItemRow
                title={LL.CardFlow.CardSettings.privacyPolicy()}
                leftIcon="privacy-policy"
                onPress={handlePrivacyPolicy}
              />
            ),
          ]}
        />

        <View style={styles.dangerZoneSection}>
          <Text style={styles.dangerZoneTitle}>{LL.AccountScreen.dangerZone()}</Text>
          <SettingItemRow
            title={LL.CardFlow.CardSettings.closeCardAccount()}
            subtitle={LL.CardFlow.CardSettings.closeCardAccountDescription()}
            leftIcon="trash"
            leftIconColor={colors.error}
            titleStyle={styles.dangerZoneRowTitle}
            subtitleStyle={styles.dangerZoneRowSubtitle}
            onPress={handleCloseCardAccount}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 20,
  },
  notificationsSection: {
    gap: 3,
  },
  supportSection: {
    gap: 3,
  },
  sectionTitle: {
    color: colors.black,
    fontFamily: "Source Sans Pro",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20,
  },
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: 8,
  },
  dividerStyle: {
    marginHorizontal: 22,
  },
  dangerZoneSection: {
    gap: 3,
  },
  dangerZoneTitle: {
    color: colors.error,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
  },
  dangerZoneRowTitle: {
    color: colors.error,
  },
  dangerZoneRowSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
}))
