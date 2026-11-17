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
import { AccountMode } from "@app/types/account"
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles } from "@rn-vui/themed"

const CALLBACK_DELAY = 3000

export const ModeSwitchSuccessScreen = () => {
  const styles = useStyles()

  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "selfCustodialModeSwitchSuccess">
    >()
  const route =
    useRoute<RouteProp<RootStackParamList, "selfCustodialModeSwitchSuccess">>()

  const { LL } = useI18nContext()
  const message =
    route.params.mode === AccountMode.Anon
      ? LL.ModeSwitchSuccessScreen.anon()
      : LL.ModeSwitchSuccessScreen.enhanced()

  useEffect(() => {
    const timeout = setTimeout(() => navigation.goBack(), CALLBACK_DELAY)
    return () => clearTimeout(timeout)
  }, [navigation])

  return (
    <Screen preset="scroll" style={styles.screen} headerShown={false}>
      <View style={styles.container}>
        <SuccessIconAnimation>
          <GaloyIcon name={"payment-success"} size={128} />
        </SuccessIconAnimation>
        <CompletedTextAnimation>
          <Text type="h2" style={styles.successText}>
            {message}
          </Text>
        </CompletedTextAnimation>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  successText: {
    marginTop: 20,
    paddingHorizontal: 20,
    textAlign: "center",
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
