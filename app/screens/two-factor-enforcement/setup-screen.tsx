import React, { useCallback, useEffect, useLayoutEffect } from "react"
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
  RegistrationReturnRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { TwoFactorMethod } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"

const RETURN_ROUTE: RegistrationReturnRoute = "twoFactorSetup"

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
  const { promptReverification, spinner: isReverifying } = useEmailReverification()

  const isEmailMissing = missingMethod === TwoFactorMethod.Email
  const missingMethodTitle = isEmailMissing
    ? LL.TwoFactorEnforcement.addEmail()
    : LL.TwoFactorEnforcement.addPhoneNumber()

  /** While an email re-verification runs, the screen holds still: the hook navigates
   *  to the code screen when it is done, and that must land on this screen, not on
   *  another flow or on whatever lies beneath once this one is gone. */
  const handleClose = useCallback(() => {
    if (isReverifying) return
    navigation.goBack()
  }, [navigation, isReverifying])

  useLayoutEffect(() => {
    navigation.setOptions(headerCloseControlOptions({ onPress: handleClose }))
  }, [navigation, handleClose])

  /** The flows this screen hands off to return into it. Once the account holds two
   *  factors there is nothing left to offer, so it steps aside rather than asking for a
   *  factor the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. */
  const isSetupComplete = isFocused && hasTwoFactor
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  /** Each flow is told to come back here when it succeeds, rather than to the
   *  destination it has on its own; this screen then steps aside to wherever it was
   *  opened from. The phone flow already pops back to its caller. */
  const handleAddMissingMethod = useCallback(() => {
    logTwoFactorSetupStarted({ tier, method: missingMethod })
    if (unverifiedEmail) {
      promptReverification(unverifiedEmail, RETURN_ROUTE)
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
