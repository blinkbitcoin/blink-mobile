import * as React from "react"
import { Image, ScrollView, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import MonkeyTyping from "@app/assets/images/monkey-typing.gif"

export const LoadingCardScreen: React.FC = () => {
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
              <Icon
                name={"time-outline"}
                type="ionicon"
                color={colors._green}
                size={40}
              />
            </View>
          </View>

          <Text type="h2" style={styles.welcomeTitle}>
            {LL.CardFlow.Onboarding.LoadingCard.title()}
          </Text>

          <View style={styles.imageContainer}>
            <Image
              source={MonkeyTyping}
              style={styles.typingMonkeyImage}
              resizeMode="cover"
            />
          </View>
          <Text type="p1" style={styles.bodySubText}>
            {LL.CardFlow.Onboarding.LoadingCard.codingBackend()}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.LoadingCard.buttonText()}
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
  welcomeTitle: {
    paddingHorizontal: 20,
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 20,
  },
  bodySubText: {
    lineHeight: 26,
    textAlign: "center",
    marginTop: 20,
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 17 / 13,
    marginTop: 20,
    overflow: "hidden",
  },
  typingMonkeyImage: {
    width: "100%",
    height: "100%",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
