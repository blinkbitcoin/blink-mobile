import React, { useMemo } from "react"
import { Linking, View } from "react-native"
import Icon from "react-native-vector-icons/Ionicons"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"
import { RouteProp, useRoute } from "@react-navigation/native"

import {
  IconTextButton,
  InfoSection,
  StatusBadge,
  WarningCard,
} from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { CardTransaction, MOCK_TRANSACTIONS } from "./card-mock-data"

type CardTransactionDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  "cardTransactionDetailsScreen"
>

export const CardTransactionDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const { feedbackEmailAddress } = useRemoteConfig()
  const route = useRoute<CardTransactionDetailsScreenRouteProp>()

  const { transactionId } = route.params

  const transaction = useMemo(
    () =>
      MOCK_TRANSACTIONS.flatMap((group) => group.transactions).find(
        (t) => t.id === transactionId,
      ),
    [transactionId],
  )

  if (!transaction) {
    return (
      <Screen preset="scroll">
        <View style={styles.content}>
          <Text style={styles.notFoundText}>
            {LL.CardFlow.TransactionDetails.transactionNotFound()}
          </Text>
        </View>
      </Screen>
    )
  }

  const supportTeam = LL.CardFlow.TransactionDetails.supportTeam()
  const helpText = LL.CardFlow.TransactionDetails.transactionHelpDescription({
    supportTeam,
  })
  const [helpBefore, helpAfter] = helpText.split(supportTeam)

  const handleViewOnMap = () => {
    console.log("View on map:", transaction.details.location)
  }

  const handleDownloadReceipt = () => {
    console.log("Download receipt:", transaction.id)
  }

  const handleReportIssue = () => {
    console.log("Report issue:", transaction.id)
  }

  return (
    <Screen preset="scroll">
      <View style={styles.content}>
        <TransactionHero transaction={transaction} />

        <InfoSection
          title={LL.CardFlow.TransactionDetails.cardInformation()}
          items={[
            {
              label: LL.CardFlow.TransactionDetails.amount(),
              value: transaction.amount,
            },
            {
              label: LL.CardFlow.TransactionDetails.time(),
              value: transaction.details.time,
            },
            {
              label: LL.CardFlow.TransactionDetails.transactionId(),
              value: transaction.details.transactionId,
            },
            {
              label: LL.CardFlow.TransactionDetails.cardUsed(),
              value: transaction.details.cardUsed,
            },
            {
              label: LL.CardFlow.TransactionDetails.paymentMethod(),
              value: transaction.details.paymentMethod,
            },
          ]}
        />

        <InfoSection
          title={LL.CardFlow.TransactionDetails.merchantInformation()}
          items={[
            {
              label: LL.CardFlow.TransactionDetails.merchant(),
              value: transaction.details.merchant,
            },
            {
              label: LL.CardFlow.TransactionDetails.category(),
              value: transaction.details.category,
            },
            {
              label: LL.CardFlow.TransactionDetails.location(),
              value: transaction.details.location,
            },
            {
              label: LL.CardFlow.TransactionDetails.mccCode(),
              value: transaction.details.mccCode,
            },
          ]}
        />

        <InfoSection
          title={LL.CardFlow.TransactionDetails.currencyConversion()}
          items={[
            {
              label: LL.CardFlow.TransactionDetails.bitcoinRate(),
              value: transaction.details.bitcoinRate,
            },
            {
              label: LL.CardFlow.TransactionDetails.bitcoinSpent(),
              value: transaction.details.bitcoinSpent,
            },
            {
              label: LL.CardFlow.TransactionDetails.conversionFee(),
              value: transaction.details.conversionFee,
              valueColor: colors.success,
            },
          ]}
        />

        <View style={styles.actionsContainer}>
          <IconTextButton
            icon="map"
            label={LL.CardFlow.TransactionDetails.viewOnMap()}
            onPress={handleViewOnMap}
          />
          <IconTextButton
            icon="download"
            label={LL.CardFlow.TransactionDetails.downloadReceipt()}
            onPress={handleDownloadReceipt}
          />
          <IconTextButton
            icon="report-flag"
            label={LL.CardFlow.TransactionDetails.reportIssue()}
            onPress={handleReportIssue}
            iconColor={colors.error}
            textColor={colors.error}
          />
        </View>

        <WarningCard
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
  transaction: CardTransaction
}

const TransactionHero: React.FC<TransactionHeroProps> = ({ transaction }) => {
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
        <Text style={styles.amount}>{transaction.amount}</Text>
        <Text style={styles.merchantName}>{transaction.details.merchant}</Text>
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
  notFoundText: {
    color: colors.grey2,
    textAlign: "center",
    marginTop: 40,
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
  actionsContainer: {
    gap: 14,
  },
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
