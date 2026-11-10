import * as React from "react"
import { Platform, View } from "react-native"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { BlinkCard } from "@app/components/blink-card/blink-card"
import { Screen } from "@app/components/screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { fonts } from "@app/rne-theme/fonts"
import { formatDateFromNow } from "@app/utils/date"

const CARD_DISPLAY_PLACEHOLDER = {
  cardNumber: "2121",
  holderName: "SATOSHI NAKAMOTO",
}

export const CardIntroducingScreen: React.FC = () => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const validThruDate = React.useMemo(
    () => formatDateFromNow({ years: 5, format: "iso" }),
    [],
  )

  return (
    <Screen>
      <View style={styles.body}>
        <BlinkCard
          cardNumber={CARD_DISPLAY_PLACEHOLDER.cardNumber}
          holderName={CARD_DISPLAY_PLACEHOLDER.holderName}
          validThruDate={validThruDate}
          showValidThru
          isFrozen={false}
        />
        <View style={styles.textContainer}>
          <Text type="h2" bold>
            {LL.CardFlow.Onboarding.CardIntroducing.cardInfo.bitcoinCard()}
          </Text>
          <View style={styles.forContainer}>
            <View style={styles.lineStyle} />
            <Text type="p1" style={styles.forText}>
              {LL.CardFlow.Onboarding.CardIntroducing.cardInfo.for()}
            </Text>
            <View style={styles.lineStyle} />
          </View>
          <Text type="h2" bold>
            {LL.CardFlow.Onboarding.CardIntroducing.cardInfo.bitcoiners()}
          </Text>
        </View>
      </View>
      <View style={styles.buttonsContainer}>
        <GaloyPrimaryButton
          title={LL.CardFlow.Onboarding.CardIntroducing.buttonText()}
          onPress={() => navigation.navigate("cardOnboardingDetailsScreen")}
        />
      </View>
    </Screen>
  )
}

/** The platform check sits inside the factory rather than in a module constant so the
 *  spec can vary `Platform.OS` per case without re-importing the module. */
const useStyles = makeStyles(({ colors }) => {
  const italicFontStyle = Platform.OS === "ios" ? { fontStyle: "italic" as const } : {}

  return {
    body: {
      flex: 1,
      paddingHorizontal: 20,
      paddingTop: 30,
      gap: 60,
    },
    buttonsContainer: {
      justifyContent: "flex-end",
      marginBottom: 14,
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    textContainer: {
      gap: 10,
      alignItems: "center",
    },
    forContainer: {
      alignItems: "center",
      flexDirection: "row",
      gap: 5,
      justifyContent: "center",
    },
    forText: {
      fontFamily: fonts.italic,
      ...italicFontStyle,
    },
    lineStyle: {
      height: 1,
      width: 16,
      backgroundColor: colors.textOnBackground,
    },
  }
})
