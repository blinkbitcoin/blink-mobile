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
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles } from "@rn-vui/themed"

const CALLBACK_DELAY = 3000

export const ConversionSuccessScreen = () => {
  const styles = useStyles()

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "conversionSuccess">>()
  const route = useRoute<RouteProp<RootStackParamList, "conversionSuccess">>()

  const { LL } = useI18nContext()
  const returnToMigration = route.params?.returnToMigration

  useEffect(() => {
    /** A migration conversion resumes via the migration entry (as the Settings row does); a
     *  standalone one returns to Home. */
    const continueAfterSuccess = () => {
      if (returnToMigration) {
        navigation.replace("accountMigrationEntry")
        return
      }
      navigation.popToTop()
    }
    const timeout = setTimeout(continueAfterSuccess, CALLBACK_DELAY)
    return () => clearTimeout(timeout)
  }, [navigation, returnToMigration])

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
