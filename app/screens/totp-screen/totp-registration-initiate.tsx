import { useEffect, useState } from "react"
import { ActivityIndicator, Alert, View } from "react-native"

import { gql } from "@apollo/client"
import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { Screen } from "@app/components/screen"
import { CopySecretComponent, QrCodeComponent } from "@app/components/totp-export"
import {
  useTotpRegistrationScreenQuery,
  useUserTotpRegistrationInitiateMutation,
} from "@app/graphql/generated"
import { useAppConfig } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { StackNavigationProp } from "@react-navigation/stack"
import { makeStyles } from "@rn-vui/base"
import { Text, useTheme } from "@rn-vui/themed"

const generateOtpAuthURI = (
  accountName: string,
  issuer: string,
  secret: string,
): string => {
  const encodedAccount = encodeURIComponent(accountName)
  const encodedIssuer = encodeURIComponent(issuer)
  const base = `otpauth://totp/${issuer}:${encodedAccount}?`
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

export const TotpRegistrationInitiateScreen = () => {
  const navigation =
    useNavigation<StackNavigationProp<RootStackParamList, "totpRegistrationInitiate">>()

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

  const otpauth = generateOtpAuthURI(username, service, secret)

  useEffect(() => {
    const fn = async () => {
      const res = await totpRegistrationInitiate()

      if (res.data?.userTotpRegistrationInitiate?.totpRegistrationId) {
        setTotpRegistrationId(res.data?.userTotpRegistrationInitiate?.totpRegistrationId)
      } else {
        Alert.alert(LL.common.error())
        return
      }

      if (res.data?.userTotpRegistrationInitiate?.totpSecret) {
        setSecret(res.data?.userTotpRegistrationInitiate.totpSecret)
      } else {
        Alert.alert(LL.common.error())
        return
      }

      setIsLoading(false)
    }
    fn()
  }, [totpRegistrationInitiate, LL])

  return (
    <Screen>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size={"large"} />
        </View>
      ) : (
        <>
          <View style={styles.centeredContent}>
            <QrCodeComponent otpauth={otpauth} />
          </View>
          <CopySecretComponent secret={secret} />
          <Text style={styles.textStyle} type="p1">
            {LL.TotpRegistrationInitiateScreen.content()}
          </Text>

          <View style={styles.buttonsContainer}>
            <GaloyPrimaryButton
              containerStyle={styles.buttonContainer}
              title={LL.common.next()}
              onPress={() =>
                navigation.navigate("totpRegistrationValidate", { totpRegistrationId })
              }
            />
          </View>
        </>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(() => ({
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  centeredContent: {
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  textStyle: {
    textAlign: "center",
    marginTop: 20,
  },
  buttonContainer: {
    marginTop: 20,
  },
  buttonsContainer: {
    flex: 1,
    justifyContent: "flex-end",
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 2,
  },
}))
