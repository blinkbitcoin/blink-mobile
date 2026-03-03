import React, { useEffect, useRef } from "react"
import { Linking, View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"

import { InfoSection, StatusBadge, InfoCard } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { CardTransactionDetailsFragment } from "@app/graphql/generated"
import { toastShow } from "@app/utils/toast"

import { useCardTransaction } from "./hooks/use-card-transaction"

// Temporary constant used as a placeholder for fields not yet available in Phase 2/3.
// TODO: remove once Phase 3 is complete.
const UNAVAILABLE = "---"

type CardTransactionDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  "cardTransactionDetailsScreen"
>

export const CardTransactionDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL, locale } = useI18nContext()
  const { feedbackEmailAddress } = useRemoteConfig()
  const { formatCurrency } = useDisplayCurrency()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<CardTransactionDetailsScreenRouteProp>()

  const { transactionId } = route.params

  const { transaction } = useCardTransaction(transactionId)
  const hasNavigatedBack = useRef(false)

  useEffect(() => {
    if (!transaction && !hasNavigatedBack.current) {
      hasNavigatedBack.current = true
      toastShow({
        message: LL.CardFlow.TransactionDetails.transactionNotFound(),
        LL,
      })
      navigation.goBack()
    }
  }, [transaction, navigation, LL])

  if (!transaction) {
    return null
  }

  const formattedAmount = formatCurrency({
    amountInMajorUnits: transaction.amount,
    currency: transaction.currency,
  })

  const formattedTime = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(transaction.createdAt))

  const supportTeam = LL.CardFlow.TransactionDetails.supportTeam()
  const helpText = LL.CardFlow.TransactionDetails.transactionHelpDescription({
    supportTeam,
  })
  const [helpBefore, helpAfter] = helpText.split(supportTeam)

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <TransactionHero transaction={transaction} formattedAmount={formattedAmount} />

        <InfoSection
          title={LL.CardFlow.TransactionDetails.cardInformation()}
          items={[
            {
              label: LL.CardFlow.TransactionDetails.amount(),
              value: formattedAmount,
            },
            {
              label: LL.CardFlow.TransactionDetails.time(),
              value: formattedTime,
            },
            {
              label: LL.CardFlow.TransactionDetails.transactionId(),
              value: transaction.id,
            },
            {
              label: LL.CardFlow.TransactionDetails.cardUsed(),
              value: UNAVAILABLE,
            },
            {
              label: LL.CardFlow.TransactionDetails.paymentMethod(),
              value: UNAVAILABLE,
            },
          ]}
        />

        <InfoSection
          title={LL.CardFlow.TransactionDetails.merchantInformation()}
          items={[
            {
              label: LL.CardFlow.TransactionDetails.merchant(),
              value: transaction.merchantName,
            },
            {
              label: LL.CardFlow.TransactionDetails.category(),
              value: UNAVAILABLE,
            },
            {
              label: LL.CardFlow.TransactionDetails.location(),
              value: UNAVAILABLE,
            },
            {
              label: LL.CardFlow.TransactionDetails.mccCode(),
              value: UNAVAILABLE,
            },
          ]}
        />

        <InfoSection
          title={LL.CardFlow.TransactionDetails.currencyConversion()}
          items={[
            {
              label: LL.CardFlow.TransactionDetails.bitcoinRate(),
              value: UNAVAILABLE,
            },
            {
              label: LL.CardFlow.TransactionDetails.bitcoinSpent(),
              value: UNAVAILABLE,
            },
            {
              label: LL.CardFlow.TransactionDetails.conversionFee(),
              value: UNAVAILABLE,
              // TODO: restore to colors.success when real value is available
              valueColor: colors.black,
            },
          ]}
        />

        {/* TODO: Action buttons hidden — the card provider does not supply merchant
         * coordinates (View on map) or receipts (Download receipt). Report issue is out of scope.
         *
         * <View style={styles.actionsContainer}>
         *   <IconTextButton icon="map" label={LL.CardFlow.TransactionDetails.viewOnMap()} onPress={() => {}} />
         *   <IconTextButton icon="download" label={LL.CardFlow.TransactionDetails.downloadReceipt()} onPress={() => {}} />
         *   <IconTextButton icon="report-flag" label={LL.CardFlow.TransactionDetails.reportIssue()} onPress={() => {}} iconColor={colors.error} textColor={colors.error} />
         * </View>
         */}

        <InfoCard
          title={LL.CardFlow.TransactionDetails.transactionHelp()}
          customDescription={
            <Text style={styles.helpDescription}>
              {helpBefore}
              <Text
                style={styles.helpLink}
                onPress={() => Linking.openURL(`mailto:${feedbackEmailAddress}`)}
              >
                {supportTeam}
              </Text>
              {helpAfter}
            </Text>
          }
        />
      </View>
    </Screen>
  )
}

type TransactionHeroProps = {
  transaction: CardTransactionDetailsFragment
  formattedAmount: string
}

const TransactionHero: React.FC<TransactionHeroProps> = ({
  transaction,
  formattedAmount,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <View style={styles.heroContainer}>
      <View style={styles.iconContainer}>
        <Icon name="storefront-outline" size={34} color={colors.primary} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.amount}>{formattedAmount}</Text>
        <Text style={styles.merchantName}>{transaction.merchantName}</Text>
      </View>
      <StatusBadge status={transaction.status} />
    </View>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 40,
    gap: 20,
  },
  heroContainer: {
    alignItems: "center",
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.grey5,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
  },
  amount: {
    color: colors.black,
    fontSize: 20,
    fontFamily: "Source Sans Pro",
    fontWeight: "700",
    lineHeight: 24,
    textAlign: "center",
  },
  merchantName: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 20,
    textAlign: "center",
  },
  // TODO: action buttons hidden — see comment above
  // actionsContainer: {
  //   gap: 14,
  // },
  helpDescription: {
    color: colors.grey2,
    fontSize: 14,
    fontFamily: "Source Sans Pro",
    fontWeight: "400",
    lineHeight: 16,
  },
  helpLink: {
    color: colors.grey2,
    textDecorationLine: "underline",
  },
}))
