import React from "react"
import { Linking, Pressable, ScrollView, View } from "react-native"

import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"
import QRCode from "react-native-qrcode-svg"

import Logo from "@app/assets/logo/blink-logo-icon.png"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { SuccessIconAnimation } from "@app/components/success-animation"
import { useClipboard } from "@app/hooks/use-clipboard"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { toBtcMoneyAmount } from "@app/types/amounts"

import type { NwcBudgetPeriod, NwcGraphqlPermission } from "./nwc-types"

export const NwcConnectionCreatedScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList, "nwcConnectionCreated">>()
  const {
    connectionString,
    appName,
    budget,
    budgets,
    permissions,
    returnUrl,
    successMode,
  } = route.params
  const { formatMoneyAmount } = useDisplayCurrency()
  const { copyToClipboard } = useClipboard()
  const isAuthorizationSuccess = successMode === "authorization"

  const handleCopy = () => {
    copyToClipboard({
      content: connectionString,
      message: LL.NostrWalletConnect.nwcStringCopied(),
    })
  }

  const resetAfterDone = (target: "home" | "connectedApps") => {
    navigation.dispatch((state) => {
      const primaryRoute = state.routes.find((route) => route.name === "Primary") ?? {
        name: "Primary",
      }
      const routes =
        target === "connectedApps"
          ? [primaryRoute, { name: "nwcConnectedApps" }]
          : [primaryRoute]

      return CommonActions.reset({
        ...state,
        routes,
        index: routes.length - 1,
      })
    })
  }

  const handleDone = () => {
    if (isAuthorizationSuccess) {
      if (returnUrl) {
        Linking.openURL(returnUrl).catch(() => resetAfterDone("home"))
        return
      }

      resetAfterDone("home")
      return
    }

    resetAfterDone("connectedApps")
  }

  const permissionLabels = (permissions ?? []).map((permission) =>
    graphqlPermissionLabel(permission, LL),
  )
  const budgetSummaries = (budgets ?? (budget ? [budget] : [])).map((budget) =>
    LL.NostrWalletConnect.budgetPreview({
      amount: formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(budget.amountSats) }),
      period: budgetPeriodLabel(budget.period, LL),
    }),
  )
  const isSatsback = appName.toLowerCase().includes("satsback")

  if (isAuthorizationSuccess) {
    return (
      <Screen preset="fixed">
        <ScrollView contentContainerStyle={styles.authorizationBody}>
          <View style={styles.successIconContainer}>
            <SuccessIconAnimation>
              <GaloyIcon name="payment-success" size={128} />
            </SuccessIconAnimation>
          </View>

          <Text style={styles.authorizationTitle}>
            {LL.NostrWalletConnect.authorizationSuccessTitle({ appName })}
          </Text>
          <Text style={styles.authorizationMessage}>
            {isSatsback
              ? LL.NostrWalletConnect.satsbackReady()
              : LL.NostrWalletConnect.authorizationSuccessBody({ appName })}
          </Text>

          <View style={styles.summarySection}>
            <Text style={styles.sectionLabel}>
              {LL.NostrWalletConnect.authorizationSummary()}
            </Text>
            <View style={styles.summaryCard}>
              {permissionLabels.map((permission) => (
                <View key={permission} style={styles.summaryRow}>
                  <GaloyIcon name="check-circle" size={18} color={colors._green} />
                  <Text style={styles.summaryText}>{permission}</Text>
                </View>
              ))}
              {budgetSummaries.map((budgetSummary) => (
                <View key={budgetSummary} style={styles.summaryRow}>
                  <GaloyIcon name="check-circle" size={18} color={colors._green} />
                  <Text style={styles.summaryText}>{budgetSummary}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton title={LL.NostrWalletConnect.done()} onPress={handleDone} />
        </View>
      </Screen>
    )
  }

  return (
    <Screen preset="fixed">
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.qrContainer}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={connectionString}
              size={180}
              backgroundColor="white"
              color="black"
              logo={Logo}
              logoSize={32}
              logoBackgroundColor="white"
              logoBorderRadius={16}
              ecl="H"
            />
          </View>
        </View>

        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {LL.NostrWalletConnect.connectionCreated()}
            </Text>
          </View>
        </View>

        <View style={styles.connectionStringSection}>
          <Text style={styles.sectionLabel}>
            {LL.NostrWalletConnect.nwcConnectionString()}
          </Text>
          <Pressable style={styles.connectionStringCard} onPress={handleCopy}>
            <Text style={styles.connectionStringText} numberOfLines={5}>
              {connectionString}
            </Text>
            <GaloyIcon name="copy-paste" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <Text style={styles.instructionText}>
          {LL.NostrWalletConnect.copyInstruction()}
        </Text>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton title={LL.NostrWalletConnect.done()} onPress={handleDone} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  qrContainer: {
    alignItems: "center",
    paddingTop: 20,
  },
  qrWrapper: {
    backgroundColor: colors._white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.grey5,
    padding: 20,
  },
  badgeContainer: {
    alignItems: "center",
  },
  badge: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors._green,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 13,
    color: colors.black,
  },
  connectionStringSection: {
    gap: 3,
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    color: colors.black,
  },
  connectionStringCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  connectionStringText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "400",
    color: colors.grey2,
  },
  instructionText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "400",
    color: colors.black,
    textAlign: "center",
  },
  buttonsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  authorizationBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  successIconContainer: {
    alignItems: "center",
    paddingTop: 24,
  },
  authorizationTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.black,
    textAlign: "center",
  },
  authorizationMessage: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    textAlign: "center",
  },
  summarySection: {
    gap: 3,
  },
  summaryCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    paddingVertical: 8,
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
}))

const budgetPeriodLabel = (
  period: NwcBudgetPeriod,
  LL: ReturnType<typeof useI18nContext>["LL"],
) =>
  ({
    DAILY: LL.NostrWalletConnect.periodDaily(),
    WEEKLY: LL.NostrWalletConnect.periodWeekly(),
    MONTHLY: LL.NostrWalletConnect.periodMonthly(),
    NEVER: LL.NostrWalletConnect.periodNever(),
  })[period]

const graphqlPermissionLabel = (
  permission: NwcGraphqlPermission,
  LL: ReturnType<typeof useI18nContext>["LL"],
) =>
  ({
    GET_INFO: LL.NostrWalletConnect.permissionGetInfo(),
    GET_BALANCE: LL.NostrWalletConnect.permissionGetBalance(),
    MAKE_INVOICE: LL.NostrWalletConnect.permissionMakeInvoice(),
    PAY_INVOICE: LL.NostrWalletConnect.permissionPayInvoice(),
    LOOKUP_INVOICE: LL.NostrWalletConnect.permissionLookupInvoice(),
    LIST_TRANSACTIONS: LL.NostrWalletConnect.permissionListTransactions(),
    NOTIFICATIONS_PAYMENT_SENT:
      LL.NostrWalletConnect.permissionNotificationsPaymentSent(),
    NOTIFICATIONS_PAYMENT_RECEIVED:
      LL.NostrWalletConnect.permissionNotificationsPaymentReceived(),
  })[permission]
