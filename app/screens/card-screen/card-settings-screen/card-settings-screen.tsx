import React, { useState } from "react"
import { Alert, Pressable, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import InAppBrowser from "react-native-inappbrowser-reborn"

import { radius } from "@app/rne-theme/radius"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { ContactSupportRow, SettingItemRow, SwitchRow } from "@app/components/card-screen"
import { SettingsGroup } from "@app/screens/settings-screen/group"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { isIos } from "@app/utils/helper"

import { useCardData } from "@app/hooks"
import { CloseCardModal } from "./close-card-modal"
import { NotificationCategory, useCloseCardAccount, useNotificationToggle } from "./hooks"
import { groupTitleGap, spacing } from "@app/rne-theme/tokens"
import { fonts } from "@app/rne-theme/fonts"

/** Lifts the 18pt Danger zone row to the 44pt minimum touch target without moving it. */
const DANGER_ZONE_HIT_SLOP = 13

export const CardSettingsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { cardTermsAndConditionsUrl, cardPrivacyPolicyUrl } = useRemoteConfig()
  const { card, hasPhysicalCard } = useCardData()
  const { isCategoryEnabled, toggleCategory } = useNotificationToggle()
  const {
    closeCard,
    loading,
    hasPendingTransactions,
    hasPositiveBalance,
    balanceDisplay,
  } = useCloseCardAccount()

  const [closeModalVisible, setCloseModalVisible] = useState(false)
  const [isDangerZoneOpen, setIsDangerZoneOpen] = useState(false)
  const dangerZoneCaret = isDangerZoneOpen ? "caret-down" : "caret-right"

  const toggleDangerZone = () => setIsDangerZoneOpen((isOpen) => !isOpen)

  const handleCloseCardPress = () => {
    if (hasPendingTransactions) {
      Alert.alert(
        LL.common.warning(),
        LL.CardFlow.CardSettings.closeCardPendingTransactions(),
      )
      return
    }

    if (hasPositiveBalance) {
      Alert.alert(
        LL.common.warning(),
        LL.CardFlow.CardSettings.closeCardBalanceWarning({ balance: balanceDisplay }),
        [
          { text: LL.common.cancel() },
          { text: LL.common.yes(), onPress: () => setCloseModalVisible(true) },
        ],
      )
      return
    }

    setCloseModalVisible(true)
  }

  const handlePersonalDetails = () => {
    navigation.navigate("cardPersonalDetailsScreen")
  }

  const handleChangePin = () => {
    navigation.navigate("cardChangePinScreen")
    // TODO: When PIN integration is complete, evaluate with real data whether to navigate
    // to cardCreatePinScreen (user has no PIN) or cardChangePinScreen (user has PIN)
  }

  const handleOrderPhysicalCard = () => {
    navigation.navigate("orderCardScreen")
  }

  const handleAddToMobileWallet = () => {
    navigation.navigate("cardAddToMobileWalletScreen", {
      lastFour: card?.lastFour ?? "",
      cardId: card?.id ?? "",
    })
  }

  const handleReplaceCard = () => {
    if (!card) return
    navigation.navigate("replaceCardScreen", { cardId: card.id })
  }

  const handleTermsAndConditions = () => {
    InAppBrowser.open(cardTermsAndConditionsUrl)
  }

  const handlePrivacyPolicy = () => {
    InAppBrowser.open(cardPrivacyPolicyUrl)
  }

  const cardManagementItems = [
    !hasPhysicalCard &&
      (() => (
        <SettingItemRow
          title={LL.CardFlow.CardSettings.orderPhysicalCard()}
          leftIcon="physical-card"
          onPress={handleOrderPhysicalCard}
        />
      )),
    () => (
      <SettingItemRow
        title={
          isIos
            ? LL.CardFlow.CardSettings.addToAppleWallet()
            : LL.CardFlow.CardSettings.addToGooglePay()
        }
        leftIcon="wallet"
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
  ].filter(Boolean) as (() => React.ReactElement)[]

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
                title={LL.CardFlow.CardSettings.changePin()}
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
                  value={isCategoryEnabled(NotificationCategory.Payments)}
                  onValueChange={(value) =>
                    toggleCategory(NotificationCategory.Payments, value)
                  }
                />
              ),
              // TODO: Temporarily commented out — the NotificationCategory scalar has no "Security" category.
              // If support is added, uncomment this block. Otherwise, remove it along with
              // the securityAlerts/securityAlertsDescription translation keys.
              // () => (
              //   <SwitchRow
              //     title={LL.CardFlow.CardSettings.securityAlerts()}
              //     description={LL.CardFlow.CardSettings.securityAlertsDescription()}
              //   />
              // ),
              () => (
                <SwitchRow
                  title={LL.CardFlow.CardSettings.marketingUpdates()}
                  description={LL.CardFlow.CardSettings.marketingUpdatesDescription()}
                  value={isCategoryEnabled(NotificationCategory.Marketing)}
                  onValueChange={(value) =>
                    toggleCategory(NotificationCategory.Marketing, value)
                  }
                />
              ),
            ]}
          />
        </View>

        <SettingsGroup
          name={LL.CardFlow.CardSettings.cardManagement()}
          titleStyle={styles.sectionTitle}
          dividerStyle={styles.dividerStyle}
          items={cardManagementItems}
        />

        <View style={styles.supportSection}>
          <Text style={styles.sectionTitle}>{LL.common.support()}</Text>
          <ContactSupportRow />
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

        <Pressable
          style={styles.dangerZoneToggle}
          onPress={toggleDangerZone}
          hitSlop={DANGER_ZONE_HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={LL.AccountScreen.dangerZone()}
          accessibilityState={{ expanded: isDangerZoneOpen }}
        >
          <GaloyIcon name={dangerZoneCaret} size={16} color={colors.textOnBackground} />
          <Text style={styles.dangerZoneToggleText}>{LL.AccountScreen.dangerZone()}</Text>
        </Pressable>

        {isDangerZoneOpen && (
          <View style={styles.dangerZoneSection}>
            <Text style={styles.sectionTitle}>{LL.AccountScreen.dangerZone()}</Text>
            <SettingItemRow
              title={LL.CardFlow.CardSettings.closeCardAccount()}
              subtitle={LL.CardFlow.CardSettings.closeCardAccountDescription()}
              leftIcon="trash"
              leftIconColor={colors.error}
              titleStyle={styles.dangerZoneRowTitle}
              subtitleStyle={styles.dangerZoneRowSubtitle}
              onPress={handleCloseCardPress}
            />
          </View>
        )}
      </View>
      <CloseCardModal
        isVisible={closeModalVisible}
        onClose={() => setCloseModalVisible(false)}
        onCloseCard={closeCard}
        loading={loading}
      />
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
    gap: groupTitleGap,
  },
  supportSection: {
    gap: groupTitleGap,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  settingsGroupContainer: {
    marginTop: 0,
    borderRadius: radius.default,
  },
  dividerStyle: {
    marginHorizontal: 22,
  },
  dangerZoneToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
  },
  dangerZoneToggleText: {
    color: colors.textOnBackground,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
  },
  dangerZoneSection: {
    gap: groupTitleGap,
  },
  dangerZoneRowTitle: {
    color: colors.error,
  },
  dangerZoneRowSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
}))
