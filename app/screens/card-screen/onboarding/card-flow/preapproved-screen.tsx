import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const CardPreapprovedScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
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
              <GaloyIcon name={"check-badge"} color={colors._green} size={45} />
            </View>
          </View>

          <Text type="h1" style={styles.welcomeTitle}>
            {LL.CardFlow.Onboarding.CardPreapproved.title()}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardPreapproved.buttonText()}
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
    paddingTop: 60,
  },
  contentContainer: {
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 15,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeTitle: {
    marginBottom: 16,
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
