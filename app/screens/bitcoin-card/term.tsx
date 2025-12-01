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

export const TermSheetScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>()

  const EQUITYS: Feature[] = [
    {
      icon: "upgrade",
      title: LL.TermSheetScreen.equitySection.investment(),
    },
    {
      icon: "coins",
      title: LL.TermSheetScreen.equitySection.valuation(),
    },
    {
      icon: "bitcoin",
      title: LL.TermSheetScreen.equitySection.units(),
    },
  ]
  const CREDITS: Feature[] = [
    {
      icon: "bank",
      title: LL.TermSheetScreen.creditBoostSection.totalCredit(),
    },
  ]

  const handleNext = () => {
    navigation.navigate("tranferInvest")
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
            <Text type="p2">{LL.TermSheetScreen.equitySection.title()}</Text>
            {EQUITYS.map((feature, index) => (
              <FeatureItem key={`feature-${index}`} feature={feature} />
            ))}
          </View>
          {/* <View style={styles.cardContainer}>
            <Text type="p2">{LL.TermSheetScreen.creditBoostSection.title()}</Text>
            {CREDITS.map((feature, index) => (
              <FeatureItem key={`feature-${index}`} feature={feature} />
            ))}
          </View> */}
        </ScrollView>

        <View style={styles.buttonsContainer}>
          <GaloyPrimaryButton
            title={LL.TermSheetScreen.buttonText()}
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
      gap: 20,
    },
    cardContainer: {
      backgroundColor: colors.grey5,
      borderRadius: 12,
      padding: 15,
      gap: 25,
    },
    featureContainer: {
      flexDirection: "row",
      alignItems: "center",
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
