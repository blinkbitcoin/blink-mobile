import React, { useCallback, useEffect, useLayoutEffect, useState } from "react"
import { View } from "react-native"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { headerCloseControlOptions } from "@app/components/header-close-control"
import { IconHero } from "@app/components/icon-hero"
import { Screen } from "@app/components/screen"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  isBackwardAction,
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { TwoFactorMethod } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"

const RETURN_ROUTE = RegistrationReturnRoute.TwoFactorSetup

/** How long the screen holds the user while a re-verification runs. A request that
 *  never answers, which the platform allows, would otherwise seal the screen; past the
 *  deadline the user may leave, and a result that arrives later reaches this screen
 *  only if it is reopened, where it joins the sequence still in flight. */
const HOLD_TIMEOUT_MS = 30_000

export const TwoFactorSetupScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "twoFactorSetup">>()
  const isFocused = useIsFocused()
  const { tier, hasTwoFactor, missingMethod, unverifiedEmail } = useTwoFactorEnforcement()
  const {
    promptReverification,
    spinner: isReverifying,
    isAskedHere: isReverifyingFromHere,
  } = useEmailReverification({ returnTo: RETURN_ROUTE })

  const isEmailMissing = missingMethod === TwoFactorMethod.Email
  const missingMethodTitle = isEmailMissing
    ? LL.TwoFactorEnforcement.addEmail()
    : LL.TwoFactorEnforcement.addPhoneNumber()

  const handleClose = useCallback(() => navigation.goBack(), [navigation])

  /** The hold is for a re-verification asked for from this screen; one joined from
   *  elsewhere, started on another screen before this one opened, only shows its
   *  spinner, since the user pressed nothing here. */
  const [isHoldExpired, setIsHoldExpired] = useState(false)
  useEffect(() => {
    setIsHoldExpired(false)
    if (!isReverifyingFromHere) return
    const timer = setTimeout(() => setIsHoldExpired(true), HOLD_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isReverifyingFromHere])
  const isHeld = isReverifyingFromHere && !isHoldExpired

  /** While an email re-verification runs, the screen holds still: the hook navigates
   *  to the code screen when it is done, and that must land on this screen, not on
   *  another flow or on whatever lies beneath once this one is gone. The hold sits on
   *  the navigator so that it covers every way back the user has, the close control and
   *  the hardware back alike; the swipe completes natively before it could be refused,
   *  so it is switched off for the interval instead. Only the user's own back is held:
   *  a removal the app dispatches, for a logout, a gate or a profile switch, goes
   *  through, and the sequence's result then reaches no screen the user has left. */
  useEffect(() => {
    if (!isHeld) return
    return navigation.addListener("beforeRemove", (event) => {
      if (!isBackwardAction(event.data.action)) return
      event.preventDefault()
    })
  }, [navigation, isHeld])

  useLayoutEffect(() => {
    navigation.setOptions({
      ...headerCloseControlOptions({ onPress: handleClose }),
      gestureEnabled: !isHeld,
    })
  }, [navigation, handleClose, isHeld])

  /** The flows this screen hands off to return into it. Once the account holds two
   *  factors there is nothing left to offer, so it steps aside rather than asking for a
   *  factor the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. And only once
   *  the hold above has lifted, which would refuse the step aside and not repeat it. */
  const isSetupComplete = isFocused && hasTwoFactor && !isHeld
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  /** Each flow is told to come back here when it succeeds, rather than to the
   *  destination it has on its own; this screen then steps aside to wherever it was
   *  opened from. The phone flow already pops back to its caller. */
  const handleAddMissingMethod = useCallback(() => {
    logTwoFactorSetupStarted({ tier, method: missingMethod })
    if (unverifiedEmail) {
      promptReverification(unverifiedEmail)
      return
    }
    if (isEmailMissing) {
      navigation.navigate("emailRegistrationInitiate", { returnTo: RETURN_ROUTE })
      return
    }
    navigation.navigate("phoneRegistrationInitiate")
  }, [
    navigation,
    tier,
    missingMethod,
    unverifiedEmail,
    promptReverification,
    isEmailMissing,
  ])

  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate", { returnTo: RETURN_ROUTE })
  }, [navigation, tier])

  return (
    <Screen preset="fixed">
      <View style={styles.container}>
        <View style={styles.body}>
          <IconHero
            icon="lock-closed"
            iconColor={colors._green}
            title={LL.TwoFactorEnforcement.setupTitle()}
            subtitle={
              <Text type="p3" style={styles.description}>
                {LL.TwoFactorEnforcement.setupDescription()}
              </Text>
            }
          />
        </View>
        {/** The authenticator is the call to action, whatever the account holds; the
         *   factor it is missing is offered underneath as the lighter alternative. */}
        <View style={styles.footer}>
          <GaloyPrimaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
            disabled={isReverifying}
          />
          {/** Re-verifying an email deletes it before registering it again, so the
           *   button waits for that to finish rather than let a second press start the
           *   sequence over on top of the first. */}
          <GaloySecondaryButton
            title={missingMethodTitle}
            onPress={handleAddMissingMethod}
            loading={isReverifying}
            disabled={isReverifying}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  body: {
    paddingTop: 10,
  },
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
  footer: {
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
}))
