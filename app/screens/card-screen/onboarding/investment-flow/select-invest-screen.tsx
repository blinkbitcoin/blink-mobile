import * as React from "react"
import { ScrollView, TouchableOpacity, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { MOCK_CREDIT_LIMIT_VALUES } from "../onboarding-mock-data"

export const SelectInvestScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const CREDIT_LIMITS = React.useMemo(
    () =>
      MOCK_CREDIT_LIMIT_VALUES.map((item) => ({
        value: item.value,
        percent: `${LL.CardFlow.Onboarding.SelectInvest.percent({ percent: item.percent })}`,
      })),
    [LL],
  )

  const [selectedLimit, setSelectedLimit] = React.useState<number | null>(null)

  const handleNext = () => {
    if (selectedLimit !== null) {
      navigation.navigate("cardOnboardingTermSheetScreen")
    }
  }

  const isContinueDisabled = selectedLimit === null

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <IconHero
          icon="btc-outline"
          iconColor={colors.primary}
          title={LL.CardFlow.Onboarding.SelectInvest.desiredCreditLimit()}
        />

        <View style={styles.limitsContainer}>
          {CREDIT_LIMITS.map((item, index) => {
            const isSelected = selectedLimit === item.value
            const isNotLastItem = index < CREDIT_LIMITS.length - 1
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.limitOption, isSelected && styles.limitOptionSelected]}
                onPress={() => setSelectedLimit(item.value)}
              >
                <Text type="p2" style={styles.limitText}>
                  ${item.value.toLocaleString()} {item.percent}
                </Text>
                {isNotLastItem && <View style={styles.limitBgOptionSelected} />}
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
  limitsContainer: {
    width: "100%",
    marginTop: 20,
  },
  limitOption: {
    position: "relative",
    width: "100%",
    height: 50,
    borderWidth: 1,
    borderColor: colors.transparent,
    overflow: "hidden",
    justifyContent: "center",
  },
  limitOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.grey6,
    borderRadius: 8,
  },
  limitBgOptionSelected: {
    width: "97%",
    height: 1,
    position: "absolute",
    bottom: 0,
    alignSelf: "center",
  },
  limitText: {
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
