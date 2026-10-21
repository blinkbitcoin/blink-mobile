import React, { useCallback, useEffect, useState } from "react"
import { ActivityIndicator, Alert, useWindowDimensions, View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { StepLayout } from "@app/components/step-layout"
import { CopySecretComponent, QrCodeComponent } from "@app/components/totp-export"
import {
  useTotpRegistrationScreenQuery,
  useUserTotpRegistrationInitiateMutation,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useScreenSecurity } from "@app/hooks/use-screen-security"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { reportError } from "@app/utils/error-logging"
import { testProps } from "@app/utils/testProps"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

const generateOtpAuthURI = (
  accountName: string,
  issuer: string,
  secret: string,
): string => {
  const encodedAccount = encodeURIComponent(accountName)
  const encodedIssuer = encodeURIComponent(issuer)
  const base = `otpauth://totp/${encodedIssuer}:${encodedAccount}?`
  const params = `secret=${secret}&issuer=${encodedIssuer}`
  return base + params
}

gql`
  query totpRegistrationScreen {
    me {
      id
      username
    }
  }

  mutation userTotpRegistrationInitiate {
    userTotpRegistrationInitiate {
      errors {
        message
      }
      totpRegistrationId
      totpSecret
    }
  }
`

const QR_FRAME_PADDING = 14
const QR_FRAME_BORDER = 2
const QR_FRAME_MAX_SIZE = 240

/** Half the screen's width, as in the design, capped so a tablet does not blow it up.
 *  The frame's padding and border come out of that size. */
const qrCodeSize = (screenWidth: number): number =>
  Math.min(Math.round(screenWidth / 2), QR_FRAME_MAX_SIZE) -
  2 * (QR_FRAME_PADDING + QR_FRAME_BORDER)

/**
 * The setup key screen: the key first, to copy into an authenticator app on this phone,
 * which is where most users keep one and where they cannot scan their own screen; the
 * QR code second, for an app on another device. Next takes the key on to the code
 * screen, and from there to its backup.
 */
export const TotpRegistrationInitiateScreen: React.FC = () => {
  /** The key and its QR code are on screen: no screenshot, recording or app-switcher
   *  snapshot of them. */
  useScreenSecurity()
  const navigation =
    useNavigation<
      NativeStackNavigationProp<RootStackParamList, "totpRegistrationInitiate">
    >()

  const [totpRegistrationInitiate] = useUserTotpRegistrationInitiateMutation()

  const { LL } = useI18nContext()

  const {
    theme: { colors },
  } = useTheme()

  const styles = useStyles()

  const { data } = useTotpRegistrationScreenQuery()
  const username = data?.me?.username || "blink"

  const [secret, setSecret] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [totpRegistrationId, setTotpRegistrationId] = useState("")

  const { appConfig } = useAppConfig()
  const service = appConfig.galoyInstance.name

  const { width: screenWidth } = useWindowDimensions()

  const otpauth = generateOtpAuthURI(username, service, secret)

  useEffect(() => {
    const fn = async () => {
      const res = await totpRegistrationInitiate()
      const payload = res.data?.userTotpRegistrationInitiate
      const registrationId = payload?.totpRegistrationId
      const setupKey = payload?.totpSecret

      if (!registrationId) {
        Alert.alert(LL.common.error())
        return
      }
      if (!setupKey) {
        Alert.alert(LL.common.error())
        return
      }

      setTotpRegistrationId(registrationId)
      setSecret(setupKey)
      setIsLoading(false)
    }
    /** A request that never reaches the server says so as a refused one does, rather
     *  than leaving the spinner up with nothing said. */
    fn().catch((err) => {
      reportError("Authenticator registration start", err)
      Alert.alert(LL.common.error())
    })
  }, [totpRegistrationInitiate, LL])

  const handleNext = useCallback(() => {
    navigation.navigate("totpRegistrationValidate", { totpRegistrationId, secret })
  }, [navigation, totpRegistrationId, secret])

  if (isLoading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size={"large"} />
        </View>
      </Screen>
    )
  }

  return (
    <StepLayout
      contentStyle={styles.content}
      footer={
        <GaloyPrimaryButton
          title={LL.common.next()}
          onPress={handleNext}
          {...testProps("totp-registration-next")}
        />
      }
    >
      <View style={styles.keyGroup}>
        <Text type="p1" style={styles.instruction}>
          {LL.AuthenticatorOnboarding.keyInstruction()}
        </Text>
        <CopySecretComponent secret={secret} isHighlighted />
      </View>
      <View style={styles.qrGroup}>
        <Text type="p1" style={styles.instruction}>
          {LL.AuthenticatorOnboarding.qrInstruction()}
        </Text>
        <QrCodeComponent
          value={otpauth}
          size={qrCodeSize(screenWidth)}
          containerStyle={styles.qrFrame}
        />
      </View>
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  content: {
    gap: 40,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  keyGroup: {
    gap: 10,
  },
  qrGroup: {
    gap: 20,
    alignItems: "center",
  },
  instruction: {
    textAlign: "center",
    color: colors.black,
  },
  qrFrame: {
    padding: QR_FRAME_PADDING,
    borderRadius: 20,
    borderWidth: QR_FRAME_BORDER,
    borderColor: colors.grey5,
  },
}))
