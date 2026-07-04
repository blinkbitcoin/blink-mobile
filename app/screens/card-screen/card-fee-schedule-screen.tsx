import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

const ANNUAL_FEE_AMOUNT = "$1,000"
const CARD_REPLACEMENT_AMOUNT = "$10.00"
const USD_TRANSACTION_FEE_AMOUNT = "1.21%"
const FOREIGN_TRANSACTION_FEE_AMOUNT = "2.21%"
const MAXIMUM_OVERDRAFT_AMOUNT = "$200"
const LATE_REPAYMENT_FEE_AMOUNT = "$25"

type Fee = {
  title: string
  subtitle?: string
  value: string
}

const FeeRow: React.FC<Fee> = ({ title, subtitle, value }) => {
  const styles = useStyles()
  return (
    <View style={styles.row}>
      <View style={styles.rowContent}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const FeeSection: React.FC<{ label: string; fees: Fee[] }> = ({ label, fees }) => {
  const styles = useStyles()
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>
        {fees.map((fee, index) => (
          <React.Fragment key={fee.title}>
            {index > 0 ? <View style={styles.separator} /> : null}
            <FeeRow {...fee} />
          </React.Fragment>
        ))}
      </View>
    </View>
  )
}

export const CardFeeScheduleScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const feeSchedule = LL.CardFlow.CardFeeSchedule
  const { fees, sections, btcConversion, feesUpdateNotice, additionalDetails } =
    feeSchedule

  const [isDetailsExpanded, setIsDetailsExpanded] = React.useState(true)

  const cardFees: Fee[] = [
    {
      title: fees.annualFee.title(),
      subtitle: fees.annualFee.subtitle(),
      value: fees.annualFee.value({ amount: ANNUAL_FEE_AMOUNT }),
    },
    {
      title: fees.cardReplacement.title(),
      value: CARD_REPLACEMENT_AMOUNT,
    },
  ]
  const transactionFees: Fee[] = [
    {
      title: fees.usdTransactionFee.title(),
      subtitle: fees.usdTransactionFee.subtitle(),
      value: USD_TRANSACTION_FEE_AMOUNT,
    },
    {
      title: fees.foreignTransactionFee.title(),
      subtitle: fees.foreignTransactionFee.subtitle(),
      value: FOREIGN_TRANSACTION_FEE_AMOUNT,
    },
  ]
  const overdraftFees: Fee[] = [
    {
      title: fees.maximumOverdraft.title(),
      subtitle: fees.maximumOverdraft.subtitle(),
      value: MAXIMUM_OVERDRAFT_AMOUNT,
    },
    {
      title: fees.lateRepaymentFee.title(),
      subtitle: fees.lateRepaymentFee.subtitle(),
      value: LATE_REPAYMENT_FEE_AMOUNT,
    },
  ]

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.effective}>{feeSchedule.effectiveDate()}</Text>

        <FeeSection label={sections.cardFees()} fees={cardFees} />
        <FeeSection label={sections.transactionFees()} fees={transactionFees} />
        <FeeSection label={sections.overdraft()} fees={overdraftFees} />

        <View style={styles.noticeCard}>
          <View style={styles.noticeTitleRow}>
            <GaloyIcon name="info" size={16} color={colors.black} />
            <Text style={styles.noticeTitle}>{btcConversion.title()}</Text>
          </View>
          <Text style={styles.noticeBody}>{btcConversion.body()}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {feesUpdateNotice.text()}{" "}
            <Text style={styles.infoLink}>{feesUpdateNotice.linkText()}</Text>.
          </Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{feeSchedule.creditModeNotice()}</Text>
        </View>

        <Pressable
          style={styles.expandTitleRow}
          onPress={() => setIsDetailsExpanded(!isDetailsExpanded)}
        >
          <GaloyIcon
            name={isDetailsExpanded ? "caret-up" : "caret-down"}
            size={16}
            color={colors.black}
          />
          <Text style={styles.expandTitle}>{additionalDetails.title()}</Text>
        </Pressable>

        {isDetailsExpanded ? (
          <View style={styles.detailsCard}>
            <Text style={styles.detailsParagraph}>
              <Text style={styles.detailsBold}>
                {additionalDetails.overdraft.label()}
              </Text>
              {additionalDetails.overdraft.text({
                maxOverdraft: MAXIMUM_OVERDRAFT_AMOUNT,
              })}
            </Text>
            <Text style={styles.detailsParagraph}>
              <Text style={styles.detailsBold}>
                {additionalDetails.foreignCurrency.label()}
              </Text>
              {additionalDetails.foreignCurrency.text()}
            </Text>
            <Text style={styles.detailsParagraph}>
              <Text style={styles.detailsBold}>
                {additionalDetails.noHiddenFees.label()}
              </Text>
              {additionalDetails.noHiddenFees.text()}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={feeSchedule.backButton()}
          onPress={() => navigation.goBack()}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  effective: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.grey1,
  },
  section: {
    gap: 3,
  },
  sectionLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  card: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 14,
  },
  rowContent: {
    flex: 1,
    gap: 1,
  },
  rowTitle: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.black,
  },
  rowSubtitle: {
    fontSize: 10,
    lineHeight: 13,
    color: colors.grey1,
  },
  rowValue: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: colors.black,
    textAlign: "right",
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey4,
  },
  noticeCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 14,
  },
  noticeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  noticeTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: colors.black,
  },
  noticeBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey1,
  },
  infoBox: {
    backgroundColor: colors.grey5,
    borderLeftWidth: 2,
    borderLeftColor: colors.black,
    borderRadius: 6,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 10,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.black,
  },
  infoLink: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
    color: colors.primary,
  },
  expandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  expandTitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.black,
  },
  detailsCard: {
    backgroundColor: colors.grey5,
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  detailsParagraph: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.grey1,
  },
  detailsBold: {
    fontWeight: "700",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
}))
