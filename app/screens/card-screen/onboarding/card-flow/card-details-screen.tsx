import * as React from "react"
import { View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Divider, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { radius } from "@app/rne-theme/radius"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { FeatureRow, FeatureRowProps } from "@app/components/card-screen"
import { StepLayout } from "@app/components/step-layout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { staticSurface } from "@app/rne-theme/surfaces"

const UPCOMING_FEATURES_MONTHS = 12
const DIVIDER_WIDTH = 1

export const CardDetailsScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const FEATURES: FeatureRowProps[] = React.useMemo(() => {
    const upcomingBadge = LL.CardFlow.Onboarding.CardDetails.availableIn({
      months: UPCOMING_FEATURES_MONTHS,
    })

    return [
      {
        icon: "card" as const,
        title: LL.CardFlow.Onboarding.CardDetails.features.card.title(),
        subtitle: LL.CardFlow.Onboarding.CardDetails.features.card.subtitle(),
      },
      {
        icon: "headset" as const,
        title: LL.CardFlow.Onboarding.CardDetails.features.accountManager.title(),
        subtitle: LL.CardFlow.Onboarding.CardDetails.features.accountManager.subtitle(),
      },
      {
        icon: "bitcoin" as const,
        title: LL.CardFlow.Onboarding.CardDetails.features.onOffRamping(),
        badge: upcomingBadge,
      },
    ]
  }, [LL])

  const handleNext = () => {
    navigation.navigate("cardOnboardingSubscribeScreen")
  }

  return (
    <StepLayout
      footer={
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardDetails.buttonText()}
          onPress={handleNext}
        />
      }
    >
      <View style={styles.content}>
        <View style={styles.cardContainer}>
          {FEATURES.map((feature, index) => {
            const hasDivider = index > 0

            return (
              <React.Fragment key={`feature-${index}`}>
                {hasDivider && (
                  <Divider
                    color={colors.neutral}
                    width={DIVIDER_WIDTH}
                    style={styles.divider}
                  />
                )}
                <FeatureRow {...feature} />
              </React.Fragment>
            )
          })}
        </View>
        <Text type="p3" style={styles.footnote}>
          {LL.CardFlow.Onboarding.CardDetails.footnote({
            months: UPCOMING_FEATURES_MONTHS,
          })}
        </Text>
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  content: {
    paddingTop: 10,
    paddingHorizontal: 20,
    gap: 20,
  },
  cardContainer: {
    ...staticSurface(colors),
    borderRadius: radius.default,
  },
  divider: {
    marginHorizontal: 14,
  },
  footnote: {
    textAlign: "center",
  },
}))
