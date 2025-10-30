import * as React from "react"
import { Icon, makeStyles, Text, useTheme } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { View, Image, ScrollView, Animated } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

export const LoadingCard: React.FC = () => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()
  const route = useRoute<RouteProp<RootStackParamList>>()

  const progressAnim = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    if (route.name === "loadingCard") {
      Animated.timing(progressAnim, {
        toValue: 3,
        duration: 4500,
        useNativeDriver: false,
      }).start()
    }
  }, [route.name, progressAnim])

  const progressWidth1 = progressAnim.interpolate({
    inputRange: [0, 1, 1, 3],
    outputRange: ["0%", "100%", "100%", "100%"],
  })

  const progressWidth2 = progressAnim.interpolate({
    inputRange: [0, 1, 1, 2, 2, 3],
    outputRange: ["0%", "0%", "0%", "100%", "100%", "100%"],
  })

  const progressWidth3 = progressAnim.interpolate({
    inputRange: [0, 2, 2, 3],
    outputRange: ["0%", "0%", "0%", "100%"],
  })

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
                color={colors.primary}
                size={45}
              />
            </View>
          </View>

          <Text type="h1" style={styles.welcomeTitle}>
            {LL.LoadinCardScreen.title()}
          </Text>

          <Text type="p1" style={styles.bodyText} color={colors.grey3}>
            {LL.LoadinCardScreen.subtitle()}
          </Text>

          <View style={styles.imageContainer}>
            <Image
              source={require("../../assets/images/monkey-typing.gif")}
              style={styles.typingMonkeyImage}
              resizeMode="contain"
            />
          </View>
          <View style={[styles.loadingContainer]}>
            <View style={styles.loadingWrapper}>
              <View style={[styles.loading]} />
              <Animated.View
                style={[styles.loadingAnimated, { width: progressWidth1 }]}
              />
            </View>
            <View style={styles.loadingWrapper}>
              <View style={[styles.loading]} />
              <Animated.View
                style={[styles.loadingAnimated, { width: progressWidth2 }]}
              />
            </View>
            <View style={styles.loadingWrapper}>
              <View style={[styles.loading]} />
              <Animated.View
                style={[styles.loadingAnimated, { width: progressWidth3 }]}
              />
            </View>
          </View>
          <Text type="h2" style={styles.bodySubText}>
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
    borderRadius: 50,
    backgroundColor: colors.grey5,
    justifyContent: "center",
    alignItems: "center",
  },
  welcomeTitle: {
    marginBottom: 5,
    paddingHorizontal: 20,
    textAlign: "center",
  },
  bodyText: {
    lineHeight: 26,
    textAlign: "center",
  },
  bodySubText: {
    lineHeight: 26,
    textAlign: "center",
    marginTop: 25,
  },
  imageContainer: {
    width: "100%",
    alignItems: "center",
  },
  loadingContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignContent: "center",
    gap: 12,
    marginTop: 5,
  },
  loadingWrapper: {
    flex: 1,
    height: 4,
    position: "relative",
  },
  loading: {
    flex: 1,
    height: 4,
    backgroundColor: colors.grey4,
  },
  loadingAnimated: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 4,
    backgroundColor: colors.primary,
  },
  typingMonkeyImage: {
    width: "100%",
    height: undefined,
    aspectRatio: 1,
    resizeMode: "contain",
  },
  buttonsContainer: {
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
}))
