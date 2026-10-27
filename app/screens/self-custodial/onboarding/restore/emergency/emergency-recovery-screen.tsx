import React, { useCallback, useEffect } from "react"

import { RouteProp, useNavigation, useRoute } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { readEmergencyPhrase } from "./emergency-phrase"
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
  const { phraseHandle } = useRoute<EmergencyRecoveryRouteProp>().params
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const phrase = readEmergencyPhrase(phraseHandle)

  /** The phrase is gone once the flow that held it ended, and nothing on this
   *  screen works without it, so the user starts a restore again. */
  const isPhraseReleased = phrase === null
  useEffect(() => {
    if (isPhraseReleased) navigation.navigate("selfCustodialRestoreMethod")
  }, [isPhraseReleased, navigation])

  if (isPhraseReleased) return null
  return <EmergencyRecoveryFlow phrase={phrase} />
}

const EmergencyRecoveryFlow: React.FC<{ phrase: string }> = ({ phrase }) => {
  const { LL } = useI18nContext()
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
  } = useEmergencyRecovery(phrase)

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
