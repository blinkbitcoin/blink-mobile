import * as React from "react"
import { useCallback, useMemo, useState } from "react"
import { View } from "react-native"

import { useHideBalanceSetting } from "@app/hooks/use-hide-balance-setting"
import { useI18nContext } from "@app/i18n/i18n-react"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { RouteProp, useFocusEffect } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, ListItem } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { SecurityScoreCard } from "@app/components/security-score-card"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { useSecurityScore } from "@app/hooks/use-security-score"
import type { SecuritySignalKey } from "@app/types/security-score"
import { Screen } from "../../components/screen"
import { useLoginMethods } from "./account/login-methods-hook"
import type { RootStackParamList } from "../../navigation/stack-param-lists"
import BiometricWrapper from "../../utils/biometricAuthentication"
import { PinScreenPurpose } from "../../utils/enum"
import KeyStoreWrapper from "../../utils/storage/secureStorage"
import { toastShow } from "../../utils/toast"
import { Switch } from "@app/components/atomic/switch"

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "security">
  route: RouteProp<RootStackParamList, "security">
}

/** Why biometrics could not be turned on: no sensor at all, or a sensor that
 *  threw when probed, which is what a missing enrolment looks like. */
type BiometricsUnavailableReason = "noSensor" | "notEnrolled"

const BIOMETRICS_UNAVAILABLE_MESSAGE: Record<
  BiometricsUnavailableReason,
  (translations: TranslationFunctions) => string
> = {
  noSensor: (translations) => translations.SecurityScreen.biometryNotAvailable(),
  notEnrolled: (translations) => translations.SecurityScreen.biometryNotEnrolled(),
}

export const SecurityScreen: React.FC<Props> = ({ route, navigation }) => {
  const styles = useStyles()

  const { mIsBiometricsEnabled, mIsPinEnabled } = route.params
  const { alwaysHideBalance, setAlwaysHideBalance } = useHideBalanceSetting()
  const { LL } = useI18nContext()
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(mIsBiometricsEnabled)
  const [isPinEnabled, setIsPinEnabled] = useState(mIsPinEnabled)

  /**
   * `useFocusEffect` lists its callback in its own effect deps, so a fresh
   * closure each render tears down the focus listeners and re-reads the
   * keystore every time the score card's data moves underneath it.
   */
  const readDeviceLockState = useCallback(() => {
    const readBiometrics = async () =>
      setIsBiometricsEnabled(await KeyStoreWrapper.getIsBiometricsEnabled())
    const readPin = async () => setIsPinEnabled(await KeyStoreWrapper.getIsPinEnabled())

    readBiometrics()
    readPin()
  }, [])

  useFocusEffect(readDeviceLockState)

  const handleAuthenticationSuccess = useCallback(async () => {
    if (await KeyStoreWrapper.setIsBiometricsEnabled()) {
      setIsBiometricsEnabled(true)
    }
  }, [])

  const handleAuthenticationFailure = useCallback(() => {
    // This is called when a user cancels or taps out of the authentication prompt,
    // so no action is necessary.
  }, [])

  /**
   * Turns biometrics on, handing the caller whichever way it could not be used:
   * the sensor is absent, or probing it threw (no enrolment). What to do about
   * that differs by caller, so neither answer is baked in here.
   */
  const enableBiometrics = useCallback(
    async (onUnavailable: (reason: BiometricsUnavailableReason) => void) => {
      /** The probe's verdict is reached inside the try, the caller's answer runs
       *  outside it: this handler navigates, and a throw from it must not be
       *  read as a failed probe and answered a second time. */
      let unavailableReason: BiometricsUnavailableReason
      try {
        if (await BiometricWrapper.isSensorAvailable()) {
          // Presents the OS specific authentication prompt
          BiometricWrapper.authenticate(
            LL.AuthenticationScreen.setUpAuthenticationDescription(),
            handleAuthenticationSuccess,
            handleAuthenticationFailure,
          )
          return
        }
        unavailableReason = "noSensor"
      } catch {
        unavailableReason = "notEnrolled"
      }
      onUnavailable(unavailableReason)
    },
    [LL, handleAuthenticationSuccess, handleAuthenticationFailure],
  )

  /** The switch's answer: the user asked for biometrics by name, so say why it
   *  cannot be turned on and stop. Substituting a PIN would be answering a
   *  question they did not ask. */
  const warnBiometricsUnavailable = useCallback(
    (reason: BiometricsUnavailableReason) => {
      toastShow({ message: BIOMETRICS_UNAVAILABLE_MESSAGE[reason], LL })
    },
    [LL],
  )

  const goToSetPin = useCallback(
    () => navigation.navigate("pin", { screenPurpose: PinScreenPurpose.SetPin }),
    [navigation],
  )

  const onBiometricsValueChanged = useCallback(
    async (value: boolean) => {
      if (value) {
        await enableBiometrics(warnBiometricsUnavailable)
        return
      }
      if (await KeyStoreWrapper.removeIsBiometricsEnabled()) {
        setIsBiometricsEnabled(false)
      }
    },
    [enableBiometrics, warnBiometricsUnavailable],
  )

  const onPinValueChanged = async (value: boolean) => {
    if (value) {
      goToSetPin()
    } else {
      removePin()
    }
  }

  const removePin = async () => {
    if (await KeyStoreWrapper.removePin()) {
      await KeyStoreWrapper.clearPinFailureState()
      setIsPinEnabled(false)
    }
  }

  const securityScore = useSecurityScore({ isBiometricsEnabled, isPinEnabled })

  const { email, emailVerified } = useLoginMethods()
  const { promptReverification } = useEmailReverification()

  /** Registration can't be initiated while the account already holds an address,
   *  so an unverified one goes through delete-and-set-again instead — the same
   *  route the account settings row takes for this state. */
  const onEmailSignalPress = useCallback(() => {
    if (email && !emailVerified) {
      promptReverification(email)
      return
    }
    navigation.navigate("emailRegistrationInitiate")
  }, [email, emailVerified, promptReverification, navigation])

  /** The card stays dumb; the screen owns what each "Set" does. Backup rows
   *  remain tappable after completion so the flow is always re-runnable (#3828).
   *  A Record (not a switch) so adding a signal without an action fails to compile. */
  const signalActions: Record<SecuritySignalKey, () => void> = useMemo(
    () => ({
      cloudBackup: () => navigation.navigate("selfCustodialCloudBackup"),
      manualBackup: () => navigation.navigate("selfCustodialBackupSecurityChecks"),
      /** The signal is satisfied by either factor (use-security-score), so its
       *  action must not dead-end on a device whose sensor is missing or
       *  unenrolled: it falls through to setting a PIN rather than reporting a
       *  biometrics error the user cannot act on. */
      appLock: () => enableBiometrics(goToSetPin),
      hideBalance: () => setAlwaysHideBalance(true),
      twoFactor: () => navigation.navigate("totpRegistrationInitiate"),
      emailVerified: onEmailSignalPress,
    }),
    [navigation, enableBiometrics, goToSetPin, setAlwaysHideBalance, onEmailSignalPress],
  )

  const onSignalPress = useCallback(
    (key: SecuritySignalKey) => signalActions[key](),
    [signalActions],
  )

  return (
    <Screen style={styles.container} preset="scroll">
      <View style={styles.settingContainer}>
        <ListItem containerStyle={styles.listItemContainer}>
          <GaloyIcon name="fingerprint" size={24} />
          <ListItem.Content>
            <ListItem.Title>{LL.SecurityScreen.biometricTitle()}</ListItem.Title>
            <ListItem.Subtitle style={styles.textContainer}>
              {LL.SecurityScreen.biometricDescription()}
            </ListItem.Subtitle>
          </ListItem.Content>
          <Switch
            testID="biometrics-switch"
            value={isBiometricsEnabled}
            onValueChange={onBiometricsValueChanged}
          />
        </ListItem>
      </View>

      <View style={styles.settingContainer}>
        <ListItem containerStyle={styles.listItemContainer}>
          <GaloyIcon name="eye-slash" size={24} />
          <ListItem.Content>
            <ListItem.Title>{LL.SecurityScreen.hideBalanceTitle()}</ListItem.Title>
          </ListItem.Content>
          <Switch
            testID="always-hide-balance-switch"
            value={alwaysHideBalance}
            onValueChange={setAlwaysHideBalance}
          />
        </ListItem>
      </View>

      <View style={styles.settingContainer}>
        <ListItem containerStyle={styles.listItemContainer}>
          <GaloyIcon name="lock-closed" size={24} />
          <ListItem.Content>
            <ListItem.Title>{LL.SecurityScreen.pinTitle()}</ListItem.Title>
            <ListItem.Subtitle style={styles.textContainer}>
              {LL.SecurityScreen.pinDescription()}
            </ListItem.Subtitle>
          </ListItem.Content>
          <Switch
            testID="pin-switch"
            value={isPinEnabled}
            onValueChange={onPinValueChanged}
          />
        </ListItem>
      </View>

      {securityScore && (
        <SecurityScoreCard score={securityScore} onSignalPress={onSignalPress} />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  container: {
    margin: 24,
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
  },
  settingContainer: {
    backgroundColor: colors.grey5,
    borderRadius: 12,
  },
  textContainer: {
    color: colors.grey3,
  },
  listItemContainer: {
    backgroundColor: colors.transparent,
  },
}))
