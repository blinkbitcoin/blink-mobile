import React, { useCallback } from "react"

import { SuccessScreen } from "@app/components/success-screen"
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
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "conversionSuccess">>()
  const route = useRoute<RouteProp<RootStackParamList, "conversionSuccess">>()

  const { LL } = useI18nContext()
  const returnTo = route.params?.returnTo

  /** A drain conversion resumes the flow that demanded it (migration entry, or the mode
   *  selection for the Anon switch); a standalone one returns to Home. */
  const continueAfterSuccess = useCallback(() => {
    if (returnTo === DrainConversionReturn.Migration) {
      navigation.replace("accountMigrationEntry")
      return
    }
    if (returnTo === DrainConversionReturn.ModeSelection) {
      navigation.dispatch(MODE_SELECTION_RETURN)
      return
    }
    navigation.popToTop()
  }, [navigation, returnTo])

  return (
    <SuccessScreen
      title={LL.ConversionSuccessScreen.message()}
      onHoldEnd={continueAfterSuccess}
    />
  )
}
