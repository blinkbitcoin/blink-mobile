import * as React from "react"
import { ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import {
  MOCK_BITCOIN_BALANCE,
  MOCK_INVESTMENT_AMOUNT,
  MOCK_INVESTMENT_SHORTFALL,
} from "../onboarding-mock-data"

export const InsufficientBalanceScreen: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const handleDeposit = () => {
    navigation.navigate("cardOnboardingTopUpScreen")
  }

  return (
    <Screen>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.contentContainer}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <GaloyIcon name={"info"} color={colors.primary} size={35} />
            </View>
          </View>

          <Text type="h2" style={styles.title}>
            {LL.CardFlow.Onboarding.InsufficientBalance.title()}
          </Text>

          <Text type="p1" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.InsufficientBalance.paragraphs.body1({
              bitcoinBalance: MOCK_BITCOIN_BALANCE,
            })}
          </Text>

          <Text type="p1" style={styles.bodyText}>
            {LL.CardFlow.Onboarding.InsufficientBalance.paragraphs.body2({
              shortfall: MOCK_INVESTMENT_SHORTFALL,
              investmentAmount: MOCK_INVESTMENT_AMOUNT,
            })}
          </Text>

          <Text type="p1" style={styles.bodyText}>
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
    marginBottom: 40,
    textAlign: "center",
    fontWeight: "bold",
    width: "100%",
  },
  bodyText: {
    marginBottom: 24,
    lineHeight: 26,
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
