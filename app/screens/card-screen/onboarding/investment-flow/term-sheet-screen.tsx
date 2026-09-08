import * as React from "react"
import { ScrollView, View } from "react-native"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Feature, FeatureItem } from "@app/components/card-screen"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import {
  formatUnitCount,
  formatUsdAmount,
  resolveEquityPercent,
  resolveInvestmentTerms,
} from "./investment-terms"

type TermSheetRoute = RouteProp<RootStackParamList, "cardOnboardingTermSheetScreen">

export const TermSheetScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { selectedAmountUsd } = useRoute<TermSheetRoute>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const terms = React.useMemo(
    () => resolveInvestmentTerms(selectedAmountUsd),
    [selectedAmountUsd],
  )

  const EQUITIES: Feature[] = React.useMemo(
    () => [
      {
        icon: "upgrade" as const,
        title: LL.CardFlow.Onboarding.TermSheet.equitySection.investment({
          amount: formatUsdAmount(terms.totalUsd),
        }),
      },
      {
        icon: "coins" as const,
        title: LL.CardFlow.Onboarding.TermSheet.equitySection.valuation(),
      },
      {
        icon: "bitcoin" as const,
        title: LL.CardFlow.Onboarding.TermSheet.equitySection.units({
          units: formatUnitCount(terms.units),
          percent: resolveEquityPercent(terms),
        }),
      },
    ],
    [LL, terms],
  )

  const handleNext = () => {
    navigation.navigate("cardOnboardingTransferInvestScreen", { selectedAmountUsd })
  }

  return (
    <Screen headerShown={false}>
      <CloseHeader testID="term-sheet-close" />
      <View style={styles.container}>
        <Text type="h1" style={styles.title}>
          {LL.CardFlow.Onboarding.TermSheet.title()}
        </Text>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.cardContainer}>
            <Text type="p2">
              {LL.CardFlow.Onboarding.TermSheet.equitySection.title()}
            </Text>
            {EQUITIES.map((feature, index) => (
              <FeatureItem key={`feature-${index}`} feature={feature} />
            ))}
          </View>
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.CardFlow.Onboarding.TermSheet.buttonText()}
            onPress={handleNext}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
  },
  title: {
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
  },
  cardContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    padding: 15,
    gap: 25,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
