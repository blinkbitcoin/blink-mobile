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

  const { balanceUsd, shortfallUsd } = useInvestmentFunding(terms.totalUsd)

  const handleDeposit = () => {
    navigation.navigate("receiveBitcoin")
  }

  return (
    <Screen headerShown={false}>
      <CloseHeader testID="insufficient-balance-close" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="info"
          iconColor={colors.primary}
          title={LL.CardFlow.Onboarding.InsufficientBalance.title()}
        />

        <View style={styles.content}>
          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.InsufficientBalance.paragraphs.body1({
              bitcoinBalance: formatUsdAmount(balanceUsd),
            })}
          </Text>

          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.InsufficientBalance.paragraphs.body2({
              shortfall: formatUsdAmount(shortfallUsd),
              investmentAmount: formatUsdAmount(terms.totalUsd),
            })}
          </Text>

          <Text type="p2" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.InsufficientBalance.paragraphs.body3()}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.InsufficientBalance.buttonText()}
          onPress={handleDeposit}
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
