import React, { useEffect } from "react"
import { View } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { Screen } from "@app/components/screen"
import {
  SuccessIconAnimation,
  CompletedTextAnimation,
} from "@app/components/success-animation"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceEntry,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { DrainConversionReturn } from "@app/screens/conversion-flow/drain-conversion"
import { AccountMode } from "@app/types/account"
import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles } from "@rn-vui/themed"

const CALLBACK_DELAY = 3000

/** Rebuilds the path the drain came from, with the Anon switch preselected to resume it. */
const MODE_SELECTION_RETURN = CommonActions.reset({
  index: 2,
  routes: [
    { name: "Primary" },
    { name: "settings" },
    {
      name: "selfCustodialChooseExperience",
      params: {
        entry: ChooseExperienceEntry.Settings,
        initialMode: AccountMode.Anon,
      },
    },
  ],
})

export const ConversionSuccessScreen = () => {
  const styles = useStyles()

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "conversionSuccess">>()
  const route = useRoute<RouteProp<RootStackParamList, "conversionSuccess">>()

  const { LL } = useI18nContext()
  const returnTo = route.params?.returnTo

  useEffect(() => {
    /** A drain conversion resumes the flow that demanded it (migration entry, or the mode
     *  selection for the Anon switch); a standalone one returns to Home. */
    const continueAfterSuccess = () => {
      if (returnTo === DrainConversionReturn.Migration) {
        navigation.replace("accountMigrationEntry")
        return
      }
      if (returnTo === DrainConversionReturn.ModeSelection) {
        navigation.dispatch(MODE_SELECTION_RETURN)
        return
      }
      navigation.popToTop()
    }
    const timeout = setTimeout(continueAfterSuccess, CALLBACK_DELAY)
    return () => clearTimeout(timeout)
  }, [navigation, returnTo])

  return (
    <Screen preset="scroll" style={styles.screen} headerShown={false}>
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
