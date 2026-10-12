/** Needed despite the automatic JSX runtime: the Jest tsconfig compiles JSX the classic
 *  way, so a file reached by a spec has to have React in scope or it fails to build. */
import React from "react"
import { Alert } from "react-native"

import useLogout from "@app/hooks/use-logout"
import { useLogoutAndRoute } from "@app/hooks/use-logout-and-route"
import { useI18nContext } from "@app/i18n/i18n-react"

import { SettingsButton } from "../../button"
import { useLoginMethods } from "../login-methods-hook"

export const LogOut = () => {
  const { phone, bothEmailAndPhoneVerified, email, emailVerified } = useLoginMethods()
  const { LL } = useI18nContext()

  const { logout } = useLogout()
  const { routeAfterLogout } = useLogoutAndRoute()

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
    const { isAppLockKept } = await logout()

    /**
     * The farewell is acknowledged before the route is taken, not after. The route can now
     * be the gate, which raises a biometric prompt the moment it opens, and an alert left
     * to fire over that prompt covers the only thing the user can answer.
     *
     * Which way out it is stays the logout's to decide: a lock kept because the device
     * still stores a wallet is owed an answer, so it returns through the gate rather than
     * landing on the screen that can open that wallet again.
     */
    Alert.alert(LL.common.loggedOut(), "", [
      {
        text: LL.common.ok(),
        onPress: () => routeAfterLogout(isAppLockKept),
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
