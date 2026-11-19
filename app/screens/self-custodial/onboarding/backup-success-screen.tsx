import React, { useCallback, useEffect } from "react"

import {
  CommonActions,
  RouteProp,
  useNavigation,
  useRoute,
} from "@react-navigation/native"

import { SuccessScreen } from "@app/components/success-screen"
import { useI18nContext } from "@app/i18n/i18n-react"
import { isBackwardAction, RootStackParamList } from "@app/navigation/stack-param-lists"

type SuccessRouteProp = RouteProp<RootStackParamList, "selfCustodialBackupSuccess">

export const BackupSuccessScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation()
  const params = useRoute<SuccessRouteProp>().params
  const reBackup = params?.reBackup ?? false
  const customMessage = params?.message

  /** Never clears the migration checkpoint: a standalone backup by another account must
   *  not wipe a pending migration, and a completed migration already cleared its own. */
  const navigateToHome = useCallback(() => {
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }))
  }, [navigation])

  /** Every way here lands with the work done and only this screen's reset to Primary
   *  ahead, which leaving clears. So the user's back goes home at once rather than back
   *  into a flow that is over: a restore's terms, with the account already active. The
   *  swipe, which the native stack cannot refuse, is switched off in the route options. */
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (!isBackwardAction(event.data.action)) return
        event.preventDefault()
        navigateToHome()
      }),
    [navigation, navigateToHome],
  )

  const fallbackMessage = reBackup
    ? LL.common.success()
    : LL.BackupScreen.ManualBackup.Success.title()

  const message = customMessage ?? fallbackMessage

  return <SuccessScreen title={message} onHoldEnd={navigateToHome} />
}
