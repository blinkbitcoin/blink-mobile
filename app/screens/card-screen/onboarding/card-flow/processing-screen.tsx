import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { formatDurationHours } from "@app/utils/date"

export const CardProcessingScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL, locale } = useI18nContext()
  const { cardProcessingWaitTimeHours } = useRemoteConfig()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const handleNext = () => {
    navigation.navigate("Primary")
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <Icon
                name={"time-outline"}
                color={colors._green}
                size={40}
                type="ionicon"
              />
            </View>
          </View>

          <Text type="h2" style={styles.title}>
            {LL.CardFlow.Onboarding.CardProcessing.title()}
          </Text>
          <Text type="p3" color={colors.grey3}>
            {LL.CardFlow.Onboarding.CardProcessing.subtitle({
              waitTime: formatDurationHours(cardProcessingWaitTimeHours, locale),
            })}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardProcessing.buttonText()}
          onPress={handleNext}
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
    marginBottom: 10,
    textAlign: "center",
    fontWeight: "bold",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
