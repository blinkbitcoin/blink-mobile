import * as React from "react"
import { ScrollView, View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { formatUsdAmount, resolveInvestmentTerms } from "./investment-terms"
import { useInvestmentFunding } from "./use-investment-funding"

type InsufficientBalanceRoute = RouteProp<
  RootStackParamList,
  "cardOnboardingInsufficientBalanceScreen"
>

export const InsufficientBalanceScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const { selectedAmountUsd } = useRoute<InsufficientBalanceRoute>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const terms = React.useMemo(
    () => resolveInvestmentTerms(selectedAmountUsd),
    [selectedAmountUsd],
  )

  const { balanceUsd, shortfallUsd, isSplitAcrossWallets } = useInvestmentFunding(
    terms.totalUsd,
  )

  const handleDeposit = () => {
    navigation.navigate("receiveBitcoin")
  }

  const handleConvert = () => {
    navigation.navigate("conversionDetails")
  }

  const copy = LL.CardFlow.Onboarding.InsufficientBalance

  /**
   * Two ways of not being able to pay, and they need opposite answers.
   *
   * Money is missing: deposit it. Money is there but sitting in both wallets, and a
   * payment draws on one: converting is what makes it payable, and telling this investor
   * to deposit would ask them for money they already have.
   *
   * The screen around them is the same, so only what it says and where its button leads
   * are chosen here.
   */
  const shortfall = isSplitAcrossWallets
    ? {
        title: copy.splitFunds.title(),
        paragraphs: [copy.splitFunds.body()],
        actionTitle: LL.common.convert(),
        onAction: handleConvert,
      }
    : {
        title: copy.title(),
        paragraphs: [
          copy.paragraphs.body1({ bitcoinBalance: formatUsdAmount(balanceUsd) }),
          copy.paragraphs.body2({
            shortfall: formatUsdAmount(shortfallUsd),
            investmentAmount: formatUsdAmount(terms.totalUsd),
          }),
          copy.paragraphs.body3(),
        ],
        actionTitle: copy.buttonText(),
        onAction: handleDeposit,
      }

  return (
    <Screen headerShown={false}>
      <CloseHeader testID="insufficient-balance-close" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero icon="info" iconColor={colors.primary} title={shortfall.title} />

        <View style={styles.content}>
          {shortfall.paragraphs.map((paragraph) => (
            <Text key={paragraph} type="p2" style={styles.bodyText}>
              {paragraph}
            </Text>
          ))}
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton title={shortfall.actionTitle} onPress={shortfall.onAction} />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 40,
  },
  content: {
    marginTop: 20,
    gap: 22,
  },
  bodyText: {
    lineHeight: 22,
    textAlign: "left",
    width: "100%",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
