import * as React from "react"
import { ActivityIndicator, ScrollView, View } from "react-native"
import {
  RouteProp,
  useIsFocused,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { WalletCurrency } from "@app/graphql/generated"
import { IconHero } from "@app/components/icon-hero"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { armInvestmentConversion } from "@app/screens/conversion-flow/drain-conversion"

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

  const {
    balanceUsd,
    balanceCurrency,
    shortfallUsd,
    hasEnoughBalance,
    isSplitAcrossWallets,
    isLoading,
  } = useInvestmentFunding(terms.totalUsd)

  /**
   * The balance is read live, so a deposit landing while this screen is up, or right
   * after the investor comes back from making one, turns the shortfall into nothing
   * missing. There is nothing left to say here then: the screen closes and the step
   * underneath, which is where the investor was sent from, takes over with the money
   * in place.
   *
   * Only while this screen is the one in front. The deposit usually lands while the
   * receive screen sits on top of this one, and a `goBack` fired from underneath pops
   * whatever is focused, which would take the receive screen away from an investor who
   * is looking at their payment arrive. The check waits for this screen to regain focus,
   * which is the moment they close it.
   */
  const isFocused = useIsFocused()
  const isCovered = !isLoading && hasEnoughBalance
  React.useEffect(() => {
    if (isCovered && isFocused) navigation.goBack()
  }, [isCovered, isFocused, navigation])

  const handleDeposit = () => {
    navigation.navigate("receiveBitcoin")
  }

  /** Armed so the conversion returns here rather than to Home, and returns knowing which
   *  investment it was for. */
  const handleConvert = () => {
    armInvestmentConversion(terms.totalUsd)
    navigation.navigate("conversionDetails")
  }

  const copy = LL.CardFlow.Onboarding.InsufficientBalance

  /** The balance shown is the fullest wallet's, whichever that is, and the sentence
   *  names that wallet: a dollar balance called a bitcoin one would be a lie. */
  const balance = formatUsdAmount(balanceUsd)
  const balanceSentence =
    balanceCurrency === WalletCurrency.Btc
      ? copy.paragraphs.balanceBitcoin({ balance })
      : copy.paragraphs.balanceDollar({ balance })

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
          balanceSentence,
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

        {/* Until the price feed answers the balance reads as zero, and the figures
            would say the investor holds nothing and owes it all; the spinner stands in
            for them, and the button waits with it. */}
        <View style={styles.content}>
          {isLoading ? (
            <ActivityIndicator
              size="large"
              color={colors.primary}
              testID="insufficient-balance-loading"
            />
          ) : (
            shortfall.paragraphs.map((paragraph) => (
              <Text key={paragraph} type="p2" style={styles.bodyText}>
                {paragraph}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={shortfall.actionTitle}
          disabled={isLoading}
          onPress={shortfall.onAction}
        />
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
