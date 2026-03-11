import * as React from "react"
import { ScrollView, TouchableOpacity, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { MOCK_CREDIT_LIMIT_VALUES } from "../onboarding-mock-data"

export const SelectInvestScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

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

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <GaloyIcon name={"btc-outline"} size={35} />
            </View>
          </View>

          <Text type="h2" style={styles.title}>
            {LL.CardFlow.Onboarding.SelectInvest.desiredCreditLimit()}
          </Text>

          <View style={styles.limitsContainer}>
            {CREDIT_LIMITS.map((item, index) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.limitOption,
                  selectedLimit === item.value && styles.limitOptionSelected,
                ]}
                onPress={() => setSelectedLimit(item.value)}
              >
                <Text type="p2" style={styles.limitText}>
                  ${item.value.toLocaleString()} {item.percent}
                </Text>
                {index < CREDIT_LIMITS.length - 1 && (
                  <View style={styles.limitBgOptionSelected} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.common.next()}
          onPress={handleNext}
          disabled={!selectedLimit}
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
  contentContainer: {
    alignItems: "center",
    flex: 1,
  },
  iconContainer: {
    marginBottom: 15,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    marginBottom: 40,
    textAlign: "center",
    fontWeight: "bold",
  },
  limitsContainer: {
    width: "100%",
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
