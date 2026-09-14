import React from "react"
import { Pressable, View } from "react-native"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { useFeatureFlags } from "@app/config/feature-flags-context"
import { useAppConfig } from "@app/hooks"
import {
  AccountOption,
  useAccountTypeOptions,
  ACCOUNT_OPTION_TO_FLOW,
} from "@app/hooks/use-account-type-options"
import { useCreationBlock } from "@app/hooks/use-creation-block"
import { useIsMounted } from "@app/hooks/use-is-mounted"
import { useSecretMenuTrigger } from "@app/hooks/use-secret-menu-trigger"
import { useI18nContext } from "@app/i18n/i18n-react"
import theme from "@app/rne-theme/theme"
import { AccountTypeMode } from "@app/types/account"
import { logGetStartedAction } from "@app/utils/analytics"
import { testProps } from "@app/utils/testProps"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import AppLogoDarkMode from "../../assets/logo/app-logo-dark.svg"
import AppLogoLightMode from "../../assets/logo/blink-logo-light.svg"
import { Screen } from "../../components/screen"
import {
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "../../navigation/stack-param-lists"
import useAppCheckToken from "./use-device-token"
import { PhoneLoginInitiateType } from "../phone-auth-screen"

export const GetStartedScreen: React.FC = () => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "getStarted">>()

  const styles = useStyles()

  /** Reached through "Add account" this screen sits on top of an existing session, so it
   *  owes the user a way back. A first install — and every flow that resets the stack to
   *  this screen, like logout or account deletion — has nothing to return to. */
  const canGoBack = navigation.canGoBack()
  React.useLayoutEffect(() => {
    navigation.setOptions({ headerShown: canGoBack })
  }, [navigation, canGoBack])

  const handleSecretMenuTap = useSecretMenuTrigger()

  const {
    theme: { mode },
  } = useTheme()
  const AppLogo = mode === "dark" ? AppLogoDarkMode : AppLogoLightMode

  const { LL } = useI18nContext()

  const { deviceAccountEnabled, nonCustodialEnabled } = useFeatureFlags()
  const { defaultSelected } = useAccountTypeOptions()
  const { checkBlockReason, isChecking, isFirstSignupRuleReady } = useCreationBlock()
  const isMounted = useIsMounted()
  /** With several types on offer this screen only navigates, so it waits on nothing a
   *  check would read. A build offering one type submits it here, and does. */
  const isOptionSubmittedHere = defaultSelected !== null
  const isCreateWaiting = isChecking || (isOptionSubmittedHere && !isFirstSignupRuleReady)

  const appCheckToken = useAppCheckToken({ skip: !deviceAccountEnabled })

  const logCreateAccountPress = () =>
    logGetStartedAction({
      action: "create_device_account",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })

  const handleCreateAccount = async () => {
    /**
     * Nothing has been chosen yet when several types are offered, so this screen locates
     * nobody and leaves the region to the screen where the choice is made. A build offering
     * a single type has no such screen, and pressing create is itself that choice.
     */
    if (!defaultSelected) {
      logCreateAccountPress()
      navigation.navigate("accountTypeSelection", { mode: AccountTypeMode.Create })
      return
    }

    const blockReason = await checkBlockReason(defaultSelected)
    if (!isMounted()) return
    if (blockReason) {
      navigation.navigate("unsupportedRegion", { reason: blockReason })
      return
    }

    /** Logged past the refusal, so a blocked user is not counted as starting a signup. */
    logCreateAccountPress()

    /** The single offered type is submitted here rather than on the account type screen, so
     *  this is where a self-custodial creation has to capture its region mode. Skipping to
     *  terms would provision the account with no mode, and nothing asks again. */
    if (defaultSelected === AccountOption.SelfCustodial) {
      navigation.navigate("selfCustodialChooseExperience", {
        onContinue: { route: ChooseExperienceContinueRoute.AcceptTerms },
      })
      return
    }

    navigation.navigate("acceptTermsAndConditions", {
      flow: ACCOUNT_OPTION_TO_FLOW[defaultSelected],
    })
  }

  const handleLogin = () => {
    logGetStartedAction({
      action: "log_in",
      createDeviceAccountEnabled: Boolean(appCheckToken),
    })

    if (nonCustodialEnabled) {
      navigation.navigate("accountTypeSelection", { mode: AccountTypeMode.Restore })
      return
    }

    navigation.navigate("login", {
      type: PhoneLoginInitiateType.Login,
    })
  }

  const {
    appConfig: {
      galoyInstance: { id },
    },
  } = useAppConfig()

  const NonProdInstanceHint =
    id === "Main" ? null : (
      <View style={styles.textInstance}>
        <Text type={"h2"} color={theme.darkColors?._orange}>
          {id}
        </Text>
      </View>
    )

  return (
    <Screen headerShown={canGoBack}>
      <View style={styles.container}>
        {NonProdInstanceHint}
        <View style={styles.logoWrapper} pointerEvents="box-none">
          <Pressable
            onPress={handleSecretMenuTap}
            style={styles.logoContainer}
            {...testProps("logo-button")}
          >
            <AppLogo width={"100%"} height={"100%"} />
          </Pressable>
        </View>
        <View style={styles.bottom}>
          <GaloyPrimaryButton
            title={LL.GetStartedScreen.createAccount()}
            onPress={handleCreateAccount}
            disabled={isCreateWaiting}
            loading={isCreateWaiting}
          />
          <GaloySecondaryButton
            title={
              nonCustodialEnabled
                ? LL.GetStartedScreen.loginOrRestore()
                : LL.GetStartedScreen.login()
            }
            onPress={handleLogin}
            containerStyle={styles.secondaryButtonContainer}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
  bottom: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "flex-end",
  },

  secondaryButtonContainer: {
    marginVertical: 15,
  },
  logoWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  logoContainer: {
    width: 288,
    height: 288,
  },
  textInstance: {
    justifyContent: "center",
    flexDirection: "row",
    textAlign: "center",
    marginTop: 24,
    marginBottom: -24,
  },
}))
