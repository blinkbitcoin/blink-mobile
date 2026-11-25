import React, { useEffect, useMemo, useRef } from "react"
import { Linking, View } from "react-native"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { InfoSection, StatusBadge, InfoCard } from "@app/components/card-screen"
import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useCardData } from "@app/hooks/use-card-data"
import { CardTransactionDetailsFragment } from "@app/graphql/generated"
import { getCountryLabel } from "@app/utils/address-metadata"
import { toastShow } from "@app/utils/toast"
import { fonts } from "@app/rne-theme/fonts"

import { merchantIcon } from "../utils/card-display"
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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const route = useRoute<CardTransactionDetailsScreenRouteProp>()

  const { transactionId, cardId } = route.params

  const { transaction } = useCardTransaction(transactionId)
  const { cards } = useCardData()
  const hasNavigatedBack = useRef(false)

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }),
    [locale],
  )

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

  const formattedTime = timeFormatter.format(new Date(transaction.createdAt))

  /** A transaction names its card by the issuer's id, which the app's cards don't carry,
   *  so the card used is the one whose list the transaction was opened from. */
  const cardUsed = cards?.find(({ id }) => id === cardId)
  const cardUsedLabel = cardUsed
    ? LL.CardFlow.TransactionDetails.cardUsedValue({ lastFour: cardUsed.lastFour })
    : UNAVAILABLE
  /** The enriched category is stored as the card network sends it, so an empty one falls
   *  back as a missing one does. */
  const category =
    transaction.enrichedMerchantCategory || transaction.merchantCategory || UNAVAILABLE
  const merchantCountry = transaction.merchantCountry
    ? getCountryLabel(transaction.merchantCountry)
    : undefined
  const location =
    [transaction.merchantCity, merchantCountry].filter(Boolean).join(", ") || UNAVAILABLE
  const mccCode = transaction.merchantCategoryCode ?? UNAVAILABLE

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
              value: cardUsedLabel,
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
              value: category,
            },
            {
              label: LL.CardFlow.TransactionDetails.location(),
              value: location,
            },
            {
              label: LL.CardFlow.TransactionDetails.mccCode(),
              value: mccCode,
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
              valueColor: colors.textOnBackground,
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
        <GaloyIcon
          name={merchantIcon(transaction.merchantCategoryCode)}
          size={34}
          color={colors.accent}
        />
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
    backgroundColor: colors.surfaceInteractive,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
    gap: 8,
  },
  amount: {
    color: colors.textOnBackground,
    fontSize: 20,
    fontFamily: fonts.bold,
    lineHeight: 24,
    textAlign: "center",
  },
  merchantName: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 20,
    textAlign: "center",
  },
  // TODO: action buttons hidden — see comment above
  // actionsContainer: {
  //   gap: 14,
  // },
  helpDescription: {
    color: colors.textMuted,
    fontSize: 14,
    fontFamily: fonts.regular,
    lineHeight: 16,
  },
  helpLink: {
    color: colors.textMuted,
    textDecorationLine: "underline",
  },
}))
