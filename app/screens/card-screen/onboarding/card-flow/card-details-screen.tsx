import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Feature, FeatureItem } from "@app/components/card-screen"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const CardDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const FEATURES: Feature[] = React.useMemo(
    () => [
      {
        icon: "graph" as const,
        title: LL.CardFlow.Onboarding.CardDetails.features.accountManager(),
      },
      {
        icon: "headset" as const,
        title: LL.CardFlow.Onboarding.CardDetails.features.support(),
      },
      {
        icon: "refresh" as const,
        title: LL.CardFlow.Onboarding.CardDetails.features.onchainDeposits(),
      },
      {
        icon: "btc-hand" as const,
        title: LL.CardFlow.Onboarding.CardDetails.features.circularEconomies(),
      },
    ],
    [LL],
  )

  const handleNext = () => {
    navigation.navigate("cardOnboardingSubscribeScreen")
  }

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.topSpacer} />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.cardContainer}>
            {FEATURES.map((feature, index) => (
              <FeatureItem key={`feature-${index}`} feature={feature} />
            ))}
            <Text type="p2">{LL.CardFlow.Onboarding.CardDetails.andMore()}</Text>
          </View>
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.CardFlow.Onboarding.CardDetails.buttonText()}
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
  topSpacer: {
    marginTop: 30,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cardContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
    padding: 15,
    gap: 30,
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
