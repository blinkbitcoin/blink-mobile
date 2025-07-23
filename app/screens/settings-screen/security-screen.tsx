import * as React from "react"
import { useState } from "react"
import { View } from "react-native"

import { useApolloClient } from "@apollo/client"
import { GaloyTertiaryButton } from "@app/components/atomic/galoy-tertiary-button"
import { useHideBalanceQuery } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RouteProp, useFocusEffect } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, Switch } from "@rn-vui/themed"

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

type Props = {
  navigation: StackNavigationProp<RootStackParamList, "security">
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
  const [isHideBalanceEnabled, setIsHideBalanceEnabled] = useState(hideBalance)

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
    if (value) {
      setIsHideBalanceEnabled(saveHideBalance(client, true))
      saveHiddenBalanceToolTip(client, true)
    } else {
      setIsHideBalanceEnabled(saveHideBalance(client, false))
      saveHiddenBalanceToolTip(client, false)
    }
  }

  const removePin = async () => {
    if (await KeyStoreWrapper.removePin()) {
      KeyStoreWrapper.removePinAttempts()
      setIsPinEnabled(false)
    }
  }

  return (
    <Screen style={styles.container} preset="scroll">
      <View style={styles.settingContainer}>
        <View style={styles.textContainer}>
          <Text type="h1">{LL.SecurityScreen.biometricTitle()}</Text>
          <Text type="p2">{LL.SecurityScreen.biometricDescription()}</Text>
        </View>
        <Switch
          style={styles.switch}
          value={isBiometricsEnabled}
          onValueChange={onBiometricsValueChanged}
        />
      </View>
      <View style={styles.settingContainer}>
        <View style={styles.textContainer}>
          <Text type="h1">{LL.SecurityScreen.pinTitle()}</Text>
          <Text type="p2">{LL.SecurityScreen.pinDescription()}</Text>
          <GaloyTertiaryButton
            title={LL.SecurityScreen.setPin()}
            onPress={() =>
              navigation.navigate("pin", { screenPurpose: PinScreenPurpose.SetPin })
            }
          />
        </View>
        <Switch
          style={styles.switch}
          value={isPinEnabled}
          onValueChange={onPinValueChanged}
        />
      </View>
      <View style={styles.settingContainer}>
        <View style={styles.textContainer}>
          <Text type="h1">{LL.SecurityScreen.hideBalanceTitle()}</Text>
          <Text type="p2">{LL.SecurityScreen.hideBalanceDescription()}</Text>
        </View>
        <Switch
          style={styles.switch}
          value={isHideBalanceEnabled}
          onValueChange={onHideBalanceValueChanged}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  container: {
    margin: 24,
    display: "flex",
    flexDirection: "column",
    rowGap: 20,
  },

  settingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  switch: {
    position: "absolute",
    right: 0,
  },

  textContainer: {
    display: "flex",
    flexDirection: "column",
    rowGap: 8,
  },
}))
