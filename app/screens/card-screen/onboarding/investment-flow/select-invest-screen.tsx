import * as React from "react"
import { ScrollView, TouchableOpacity, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { CloseHeader } from "@app/components/close-header"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { formatUsdAmount } from "./investment-figures"
import {
  INVESTMENT_OPTIONS,
  resolveEquityPercent,
  resolveInvestmentTerms,
} from "./investment-terms"

export const SelectInvestScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  /** Each amount beside the share it buys, derived the way the term sheet derives it. */
  const options = React.useMemo(
    () =>
      INVESTMENT_OPTIONS.map((usd) => ({
        usd,
        amount: formatUsdAmount(usd),
        equity: LL.CardFlow.Onboarding.SelectInvest.percent({
          percent: resolveEquityPercent(resolveInvestmentTerms(usd)),
        }),
      })),
    [LL],
  )

  const [selectedAmountUsd, setSelectedAmountUsd] = React.useState<number | null>(null)

  const handleNext = () => {
    if (selectedAmountUsd !== null) {
      navigation.navigate("cardOnboardingTermSheetScreen", { selectedAmountUsd })
    }
  }

  const isContinueDisabled = selectedAmountUsd === null

  return (
    <Screen headerShown={false}>
      <CloseHeader testID="select-invest-close" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="btc-outline"
          iconColor={colors.primary}
          title={LL.CardFlow.Onboarding.SelectInvest.title()}
        />

        <View style={styles.optionsContainer} accessibilityRole="radiogroup">
          {options.map((option, index) => {
            const isSelected = selectedAmountUsd === option.usd
            const isNotLastItem = index < options.length - 1
            return (
              <TouchableOpacity
                key={option.usd}
                style={[styles.option, isSelected && styles.optionSelected]}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                onPress={() => setSelectedAmountUsd(option.usd)}
              >
                <Text type="p2" style={styles.optionText}>
                  {option.amount} {option.equity}
                </Text>
                {isNotLastItem && <View style={styles.optionSeparator} />}
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.common.next()}
          onPress={handleNext}
          disabled={isContinueDisabled}
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
    paddingTop: 40,
  },
  optionsContainer: {
    width: "100%",
    marginTop: 20,
  },
  option: {
    position: "relative",
    width: "100%",
    /** Grows rather than clips: a fixed height cuts the longer labels off at large
     *  OS font scales, the same way the titles on the other screens did. */
    minHeight: 50,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.transparent,
    overflow: "hidden",
    justifyContent: "center",
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.grey6,
    borderRadius: 8,
  },
  optionSeparator: {
    width: "97%",
    height: 1,
    backgroundColor: colors.grey4,
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  optionText: {
    color: colors.grey0,
    paddingLeft: 10,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
