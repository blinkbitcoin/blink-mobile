import React, { useEffect } from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import {
  SuccessIconAnimation,
  CompletedTextAnimation,
} from "@app/components/success-animation"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles } from "@rn-vui/themed"

export const ConversionSuccessScreen = () => {
  const styles = useStyles()

  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "conversionSuccess">>()

  const { LL } = useI18nContext()
  const CALLBACK_DELAY = 3000
  useEffect(() => {
    const navigateToHomeTimeout = setTimeout(navigation.popToTop, CALLBACK_DELAY)
    return () => clearTimeout(navigateToHomeTimeout)
  }, [navigation])

  return (
    <Screen preset="scroll" style={styles.screen}>
      <View style={styles.container}>
        <SuccessIconAnimation>
          <GaloyIcon name={"payment-success"} size={128} />
        </SuccessIconAnimation>
        <CompletedTextAnimation>
          <Text type="h2" style={styles.successText}>
            {LL.ConversionSuccessScreen.message()}
          </Text>
        </CompletedTextAnimation>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  successText: {
    marginTop: 20,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  screen: {
    flexGrow: 1,
  },
}))
