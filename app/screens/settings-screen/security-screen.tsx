import * as React from "react"
import { useState } from "react"
import { View } from "react-native"

import { useApolloClient } from "@apollo/client"
import { useHideBalanceQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useFocusEffect } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, ListItem } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { SecurityScoreCard } from "@app/components/security-score-card"
import { useSecurityScore } from "@app/hooks/use-security-score"
import type { SecuritySignalKey } from "@app/types/security-score"
import { Screen } from "../../components/screen"
import {
  saveHiddenBalanceToolTip,
  saveHideBalance,
} from "../../graphql/client-only-query"
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

export const SecurityScreen: React.FC<Props> = ({ route, navigation }) => {
  const styles = useStyles()

  const client = useApolloClient()
  const { mIsBiometricsEnabled, mIsPinEnabled } = route.params
  const { data: { hideBalance } = { hideBalance: false } } = useHideBalanceQuery()
  const { LL } = useI18nContext()
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(mIsBiometricsEnabled)
  const [isPinEnabled, setIsPinEnabled] = useState(mIsPinEnabled)

  useFocusEffect(() => {
    getIsBiometricsEnabled()
    getIsPinEnabled()
  })
  const getIsBiometricsEnabled = async () => {
    setIsBiometricsEnabled(await KeyStoreWrapper.getIsBiometricsEnabled())
  }

  const getIsPinEnabled = async () => {
    setIsPinEnabled(await KeyStoreWrapper.getIsPinEnabled())
  }

  const onBiometricsValueChanged = async (value: boolean) => {
    if (value) {
      try {
        if (await BiometricWrapper.isSensorAvailable()) {
          // Presents the OS specific authentication prompt
          BiometricWrapper.authenticate(
            LL.AuthenticationScreen.setUpAuthenticationDescription(),
            handleAuthenticationSuccess,
            handleAuthenticationFailure,
          )
        } else {
          toastShow({
            message: (translations) => translations.SecurityScreen.biometryNotAvailable(),
            LL,
          })
        }
      } catch {
        toastShow({
          message: (translations) => translations.SecurityScreen.biometryNotEnrolled(),
          LL,
        })
      }
    } else if (await KeyStoreWrapper.removeIsBiometricsEnabled()) {
      setIsBiometricsEnabled(false)
    }
  }

  const handleAuthenticationSuccess = async () => {
    if (await KeyStoreWrapper.setIsBiometricsEnabled()) {
      setIsBiometricsEnabled(true)
    }
  }

  const handleAuthenticationFailure = () => {
    // This is called when a user cancels or taps out of the authentication prompt,
    // so no action is necessary.
  }

  const onPinValueChanged = async (value: boolean) => {
    if (value) {
      navigation.navigate("pin", { screenPurpose: PinScreenPurpose.SetPin })
    } else {
      removePin()
    }
  }

  const onHideBalanceValueChanged = (value: boolean) => {
    saveHideBalance(client, value)
    saveHiddenBalanceToolTip(client, value)
  }

  const removePin = async () => {
    if (await KeyStoreWrapper.removePin()) {
      KeyStoreWrapper.removePinAttempts()
      setIsPinEnabled(false)
    }
  }

  const securityScore = useSecurityScore({ isBiometricsEnabled, isPinEnabled })

  // The card stays dumb; the screen owns what each "Set" does. Backup rows
  // remain tappable after completion so the flow is always re-runnable (#3828).
  // A Record (not a switch) so adding a signal without an action fails to compile.
  const signalActions: Record<SecuritySignalKey, () => void> = {
    cloudBackup: () => navigation.navigate("selfCustodialCloudBackup"),
    manualBackup: () => navigation.navigate("selfCustodialBackupSecurityChecks"),
    appLock: () => onBiometricsValueChanged(true),
    hideBalance: () => onHideBalanceValueChanged(true),
    twoFactor: () => navigation.navigate("totpRegistrationInitiate"),
    emailVerified: () => navigation.navigate("emailRegistrationInitiate"),
  }

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
          <Switch value={isBiometricsEnabled} onValueChange={onBiometricsValueChanged} />
        </ListItem>
      </View>

      <View style={styles.settingContainer}>
        <ListItem containerStyle={styles.listItemContainer}>
          <GaloyIcon name="eye-slash" size={24} />
          <ListItem.Content>
            <ListItem.Title>{LL.SecurityScreen.hideBalanceTitle()}</ListItem.Title>
          </ListItem.Content>
          <Switch value={hideBalance} onValueChange={onHideBalanceValueChanged} />
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
          <Switch value={isPinEnabled} onValueChange={onPinValueChanged} />
        </ListItem>
      </View>

      {securityScore && (
        <SecurityScoreCard
          score={securityScore}
          onSignalPress={(key) => signalActions[key]()}
        />
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
