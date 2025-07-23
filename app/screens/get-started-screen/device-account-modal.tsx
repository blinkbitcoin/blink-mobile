import * as React from "react"
import { useEffect } from "react"
import { View } from "react-native"
import * as Keychain from "react-native-keychain"
import { generateSecureRandom } from "react-native-securerandom"
import { LocalizedString } from "typesafe-i18n"
import { v4 as uuidv4 } from "uuid"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useAppConfig, useSaveSessionProfile } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import {
  logAttemptCreateDeviceAccount,
  logCreateDeviceAccountFailure,
  logCreatedDeviceAccount,
} from "@app/utils/analytics"
import analytics from "@react-native-firebase/analytics"
import crashlytics from "@react-native-firebase/crashlytics"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { Text, makeStyles, useTheme } from "@rn-vui/themed"

import { DeviceAccountFailModal } from "./device-account-fail-modal"
import useAppCheckToken from "./use-device-token"
import { useFeatureFlags } from "@app/config/feature-flags-context"
import { PhoneLoginInitiateType } from "../phone-auth-screen"

const generateSecureRandomUUID = async () => {
  const randomBytes = await generateSecureRandom(16) // Generate 16 random bytes
  const uuid = uuidv4({ random: randomBytes }) // Use the random seed to generate a UUID
  return uuid
}

const DEVICE_ACCOUNT_CREDENTIALS_KEY = "device-account"

export type DeviceAccountModalProps = {
  isVisible: boolean
  closeModal: () => void
}

export const DeviceAccountModal: React.FC<DeviceAccountModalProps> = ({
  isVisible,
  closeModal,
}) => {
  const { saveProfile } = useSaveSessionProfile()
  const {
    appConfig: {
      galoyInstance: { authUrl },
    },
  } = useAppConfig()

  const { deviceAccountEnabled } = useFeatureFlags()
  const appCheckToken = useAppCheckToken({ skip: !deviceAccountEnabled })

  const [hasError, setHasError] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const { LL } = useI18nContext()
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "getStarted">>()

  const createDeviceAccountAndLogin = async () => {
    try {
      setLoading(true)
      const credentials = await Keychain.getInternetCredentials(
        DEVICE_ACCOUNT_CREDENTIALS_KEY,
      )

      let username: string
      let password: string

      if (credentials) {
        username = credentials.username
        password = credentials.password
      } else {
        username = await generateSecureRandomUUID()
        password = await generateSecureRandomUUID()
        const setPasswordResult = await Keychain.setInternetCredentials(
          DEVICE_ACCOUNT_CREDENTIALS_KEY,
          username,
          password,
        )
        if (!setPasswordResult) {
          throw new Error("Error setting device account credentials")
        }
      }

      logAttemptCreateDeviceAccount()

      const auth = Buffer.from(`${username}:${password}`, "utf8").toString("base64")

      const res = await fetch(authUrl + "/auth/create/device-account", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          Appcheck: appCheckToken || "undefined",
        },
      })

      const data: {
        result: string | undefined
      } = await res.json()

      const authToken = data.result

      if (!authToken) {
        throw new Error("Error getting session token")
      }

      logCreatedDeviceAccount()
      analytics().logLogin({ method: "device" })
      saveProfile(authToken)
      navigation.replace("Primary")
      closeModal()
    } catch (error) {
      setHasError(true)
      logCreateDeviceAccountFailure()
      if (error instanceof Error) {
        crashlytics().recordError(error)
      }
      console.log("Error with device account: ", error)
    }

    setLoading(false)
  }

  useEffect(() => {
    if (!isVisible) {
      setHasError(false)
    }
  }, [isVisible])

  const navigateToPhoneLogin = () => {
    navigation.navigate("phoneFlow", {
      screen: "phoneLoginInitiate",
      params: {
        type: PhoneLoginInitiateType.CreateAccount,
      },
    })
    closeModal()
  }

  const navigateToHomeScreen = () => {
    navigation.navigate("Primary")
    closeModal()
  }

  return hasError ? (
    <DeviceAccountFailModal
      isVisible={isVisible}
      closeModal={closeModal}
      navigateToPhoneLogin={navigateToPhoneLogin}
      navigateToHomeScreen={navigateToHomeScreen}
    />
  ) : (
    <CustomModal
      isVisible={isVisible}
      toggleModal={closeModal}
      image={<GaloyIcon name="info" color={colors.primary3} size={100} />}
      title={LL.GetStartedScreen.trialAccountHasLimits()}
      body={
        <View style={styles.modalBody}>
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.noBackup()} />
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.sendingLimit()} />
          <LimitItem text={LL.GetStartedScreen.trialAccountLimits.noOnchain()} />
        </View>
      }
      primaryButtonTitle={LL.GetStartedScreen.startWithTrialAccount()}
      primaryButtonOnPress={createDeviceAccountAndLogin}
      primaryButtonLoading={loading}
      primaryButtonDisabled={loading}
      secondaryButtonTitle={LL.GetStartedScreen.registerPhoneAccount()}
      secondaryButtonOnPress={navigateToPhoneLogin}
    />
  )
}

const LimitItem = ({ text }: { text: LocalizedString }) => {
  const styles = useStyles()

  return (
    <View style={styles.limitRow}>
      <Text type="h2" style={styles.limitText}>
        - {text}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  limitRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  limitText: {
    marginLeft: 12,
  },
  modalBody: {
    rowGap: 8,
  },
}))
