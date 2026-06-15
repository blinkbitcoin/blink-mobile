import { Alert } from "react-native"

import useLogout from "@app/hooks/use-logout"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { SettingsButton } from "../../button"
import { useLoginMethods } from "../login-methods-hook"

export const LogOut = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { phone, bothEmailAndPhoneVerified, email, emailVerified } = useLoginMethods()
  const { LL } = useI18nContext()

  const { logout } = useLogout()

  const logoutAlert = () => {
    const logAlertContent = () => {
      if (phone && email && bothEmailAndPhoneVerified) {
        return LL.AccountScreen.logoutAlertContentPhoneEmail({
          phoneNumber: phone,
          email,
        })
      } else if (email && emailVerified) {
        return LL.AccountScreen.logoutAlertContentEmail({ email })
      }
      // phone verified
      if (phone) return LL.AccountScreen.logoutAlertContentPhone({ phoneNumber: phone })
      console.error("Phone and email both not verified - Impossible to reach")
    }

    Alert.alert(LL.AccountScreen.logoutAlertTitle(), logAlertContent(), [
      {
        text: LL.common.cancel(),
        style: "cancel",
      },
      {
        text: LL.AccountScreen.IUnderstand(),
        onPress: logoutAction,
      },
    ])
  }

  const logoutAction = async () => {
    await logout()
    navigation.reset({
      index: 0,
      routes: [{ name: "getStarted" }],
    })
    Alert.alert(LL.common.loggedOut(), "", [
      {
        text: LL.common.ok(),
        onPress: () => {},
      },
    ])
  }

  return (
    <SettingsButton
      title={LL.AccountScreen.logOutAndDeleteLocalData()}
      variant="warning"
      onPress={logoutAlert}
    />
  )
}
