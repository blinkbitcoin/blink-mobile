import React, { useCallback, useState } from "react"

import { TwoFactorManualResetSheet } from "@app/custodial/components/two-factor-manual-reset-sheet"
import { TwoFactorTurnOffModal } from "@app/custodial/components/two-factor-turn-off-modal"
import { useTwoFactorTurnOff } from "@app/custodial/hooks/use-two-factor-turn-off"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { AccountType } from "@app/types/wallet"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { SettingsRow } from "./row"

/** What asking to turn the authenticator off shows, one at a time. */
const TurnOffPrompt = {
  None: "none",
  Recommendation: "recommendation",
  ManualReset: "manual_reset",
} as const
type TurnOffPrompt = (typeof TurnOffPrompt)[keyof typeof TurnOffPrompt]

/**
 * The authenticator's row: off, it opens the setup; on, it asks to turn it off, with an
 * X where the other rows have their arrow.
 * Where the authenticator is not mandatory Blink recommends keeping it, and Continue
 * asks for its code; where it is, support resets it.
 */
export const TotpSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { activeAccount } = useAccountRegistry()
  const { isTurnOffBlocked, isTurnOffDecided, reportAttempt, reportBlocked } =
    useTwoFactorTurnOff()
  const [prompt, setPrompt] = useState<TurnOffPrompt>(TurnOffPrompt.None)
  const [isCodeRequested, setIsCodeRequested] = useState(false)

  const { data, loading } = useSettingsScreenQuery({ fetchPolicy: "cache-only" })

  const askToTurnOff = useCallback(() => {
    reportAttempt()
    if (isTurnOffBlocked) {
      reportBlocked()
      setPrompt(TurnOffPrompt.ManualReset)
      return
    }
    setPrompt(TurnOffPrompt.Recommendation)
  }, [isTurnOffBlocked, reportAttempt, reportBlocked])

  const closePrompt = useCallback(() => setPrompt(TurnOffPrompt.None), [])

  /** The code screen opens once the modal is off the screen: pushed while the modal
   *  still closes, it can hang the transition, and its field does not take the focus. */
  const continueToCode = useCallback(() => {
    setIsCodeRequested(true)
    setPrompt(TurnOffPrompt.None)
  }, [])

  const openRequestedCode = useCallback(() => {
    if (!isCodeRequested) return
    setIsCodeRequested(false)
    navigate("totpDeleteValidate")
  }, [isCodeRequested, navigate])

  const openSetup = useCallback(() => navigate("totpRegistrationInitiate"), [navigate])

  if (activeAccount?.type === AccountType.SelfCustodial) return null

  const totpEnabled = Boolean(data?.me?.totpEnabled)
  const title = totpEnabled
    ? LL.TwoFactorTurnOff.statusEnabled()
    : LL.TwoFactorTurnOff.statusDisabled()
  /** The X waits for the tier reached, so a tier-three account is never offered the
   *  recommendation for the frames its record takes to read. */
  const isRowLoading = loading || !isTurnOffDecided
  const rowAction = totpEnabled ? askToTurnOff : openSetup
  const rightIcon = totpEnabled ? "close" : undefined
  const isRecommendationVisible = prompt === TurnOffPrompt.Recommendation
  const isManualResetVisible = prompt === TurnOffPrompt.ManualReset

  return (
    <>
      <SettingsRow
        loading={isRowLoading}
        title={title}
        leftGaloyIcon="lock-closed"
        action={rowAction}
        rightIcon={rightIcon}
      />
      <TwoFactorTurnOffModal
        isVisible={isRecommendationVisible}
        onKeepProtected={closePrompt}
        onContinue={continueToCode}
        onHidden={openRequestedCode}
      />
      <TwoFactorManualResetSheet isVisible={isManualResetVisible} onClose={closePrompt} />
    </>
  )
}
