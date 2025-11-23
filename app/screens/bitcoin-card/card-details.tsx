import * as React from "react"
import { makeStyles, useTheme, Text } from "@rn-vui/themed"
import { Screen } from "../../components/screen"
import { ScrollView, View } from "react-native"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  circleDiameterThatContainsSquare,
  GaloyIcon,
  IconNamesType,
} from "@app/components/atomic/galoy-icon"

interface Feature {
  icon: IconNamesType
  title: string
}

interface FeatureItemProps {
  feature: Feature
}

const FeatureItem: React.FC<FeatureItemProps> = ({ feature }) => {
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <View style={styles.featureContainer}>
      <GaloyIcon
        name={feature.icon}
        color={colors._black}
        backgroundColor={colors.primary}
        style={styles.iconStyle}
        size={19}
      />
      <Text type="p2">{feature.title}</Text>
    </View>
  )
}

export const CardDetails: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const FEATURES: Feature[] = [
    {
      icon: "graph",
      title: LL.CardDetailsScreen.features.accountManager(),
    },
    {
      icon: "headset",
      title: LL.CardDetailsScreen.features.support(),
    },
    {
      icon: "bitcoin",
      title: LL.CardDetailsScreen.features.startup(),
    },
    {
      icon: "refresh",
      title: LL.CardDetailsScreen.features.onchainDeposits(),
    },
    {
      icon: "btc-hand",
      title: LL.CardDetailsScreen.features.circularEconomies(),
    },
  ]

  const handleNext = () => {
    navigation.navigate("cardSubscribe")
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
            <Text type="p2">{LL.CardDetailsScreen.andMore()}</Text>
          </View>
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.CardDetailsScreen.buttonText()}
            onPress={handleNext}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => {
  const containerSize = circleDiameterThatContainsSquare(22)

  return {
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
      padding: 30,
    },
    featureContainer: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 30,
      gap: 15,
    },
    iconStyle: {
      borderRadius: containerSize,
      width: containerSize,
      height: containerSize,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonsContainer: {
      justifyContent: "flex-end",
      marginBottom: 14,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
  }
})
