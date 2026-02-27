import * as React from "react"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { View, Image, ScrollView } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const LoadingCard: React.FC = () => {
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
            {LL.LoadinCardScreen.title()}
          </Text>

          <View style={styles.imageContainer}>
            <Image
              source={require("../../assets/images/monkey-typing.gif")}
              style={styles.typingMonkeyImage}
              resizeMode="cover"
            />
          </View>
          <Text type="p1" style={styles.bodySubText}>
            {LL.LoadinCardScreen.codingBackend()}
          </Text>
        </View>
      </ScrollView>

      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.LoadinCardScreen.buttonText()}
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
    borderRadius: 50,
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
