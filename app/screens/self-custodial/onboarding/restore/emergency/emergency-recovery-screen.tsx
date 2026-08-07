import React, { useCallback } from "react"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import {
  EmergencyRecoveryStep,
  useEmergencyRecovery,
} from "./hooks/use-emergency-recovery"
import { BundleProgressView } from "./views/bundle-progress-view"
import { BundleRejectedView } from "./views/bundle-rejected-view"
import { BundleSourcesView } from "./views/bundle-sources-view"
import { RecoverySummaryView } from "./views/recovery-summary-view"

type EmergencyRecoveryRouteProp = RouteProp<
  RootStackParamList,
  "selfCustodialEmergencyRecovery"
>

/**
 * One route for the whole emergency-recovery flow.
 *
 * The steps are a loop rather than a line - a rejected bundle goes back to the
 * sources and round again - so pushing each onto the navigation stack would
 * leave a back button walking the user through their own failed attempts.
 */
export const EmergencyRecoveryScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const { mnemonic } = useRoute<EmergencyRecoveryRouteProp>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const {
    step,
    rejection,
    verified,
    busy,
    fromCloud,
    fromClipboard,
    fromFile,
    tryAnotherSource,
    exportBundle,
  } = useEmergencyRecovery(mnemonic)

  const openSupport = useCallback(
    () => navigation.navigate("onboarding", { screen: "supportScreen" }),
    [navigation],
  )
  const restoreOther = useCallback(
    () => navigation.navigate("selfCustodialRestoreMethod"),
    [navigation],
  )

  if (step === EmergencyRecoveryStep.Sources) {
    return (
      <BundleSourcesView
        busy={busy}
        onCloud={fromCloud}
        onClipboard={fromClipboard}
        onFile={fromFile}
        onHelp={openSupport}
      />
    )
  }

  if (step === EmergencyRecoveryStep.Rejected && rejection) {
    return (
      <BundleRejectedView
        rejection={rejection}
        onTryAgain={tryAnotherSource}
        onRestoreOther={restoreOther}
        onHelp={openSupport}
      />
    )
  }

  if (step === EmergencyRecoveryStep.Verified) {
    return (
      <BundleProgressView
        icon="payment-success"
        caption={LL.EmergencyRecovery.verified()}
        testID="bundle-verified-view"
      />
    )
  }

  if (step === EmergencyRecoveryStep.Summary && verified) {
    return (
      <RecoverySummaryView
        verified={verified}
        onExport={exportBundle}
        onSupport={openSupport}
        onClose={restoreOther}
      />
    )
  }

  return (
    <BundleProgressView
      icon="payment-pending"
      caption={LL.EmergencyRecovery.verifying()}
      testID="bundle-verifying-view"
    />
  )
}
