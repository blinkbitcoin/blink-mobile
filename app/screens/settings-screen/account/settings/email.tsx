import React from "react"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { ContactChangeNeedsAuthenticatorModal } from "@app/custodial/components/contact-change-needs-authenticator-modal"
import { useContactChange } from "@app/custodial/hooks/use-contact-change"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ContactField } from "@app/types/two-factor-enforcement"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { SettingsRow } from "../../row"
import { useLoginMethods } from "../login-methods-hook"

const title = (
  email: string | undefined,
  emailVerified: boolean,
  LL: TranslationFunctions,
): string => {
  if (email) {
    if (emailVerified) return email?.toString()
    return LL.AccountScreen.unverifiedEmail()
  }
  return LL.AccountScreen.tapToAddEmail()
}

type EmailRowState = {
  hasEmail: boolean
  isUnverified: boolean
  isChangeable: boolean
}

type RowEnd = {
  /** Undefined keeps the row's arrow, null shows nothing. */
  icon?: IconNamesType | null
  onPress?: () => void
}

/** What the end of the row offers: confirming an unverified address again, changing a
 *  verified one the phone number backs, nothing for the account's only login method,
 *  and the row's own arrow to add one. */
const emailRowEnd = (
  { hasEmail, isUnverified, isChangeable }: EmailRowState,
  actions: { reverify: () => void; change: () => void },
): RowEnd => {
  if (isUnverified) return { icon: "refresh", onPress: actions.reverify }
  if (isChangeable) return { icon: "pencil", onPress: actions.change }
  if (hasEmail) return { icon: null }
  return {}
}

/**
 * The login email: added from the row, confirmed again while unverified, and changed
 * from its pen while the phone number keeps the account reachable, since the server
 * changes it by removing it and adding the new one.
 */
export const EmailSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { loading, email, emailVerified, bothEmailAndPhoneVerified, hasAuthenticator } =
    useLoginMethods()
  const { promptReverification, spinner: reverifying } = useEmailReverification()
  const change = useContactChange(ContactField.Email, hasAuthenticator)

  const hasEmail = Boolean(email)
  const isUnverified = hasEmail && !emailVerified

  const reverify = () => {
    if (email) promptReverification(email)
  }
  const addEmail = () => navigate("emailRegistrationInitiate")

  const rowAction = hasEmail ? null : addEmail
  const rowEnd = emailRowEnd(
    { hasEmail, isUnverified, isChangeable: bothEmailAndPhoneVerified },
    { reverify, change: change.startChange },
  )

  return (
    <>
      <SettingsRow
        loading={loading}
        spinner={reverifying}
        title={title(email, emailVerified, LL)}
        leftGaloyIcon="email-add"
        action={rowAction}
        rightIcon={rowEnd.icon}
        rightIconAction={rowEnd.onPress}
      />
      <ContactChangeNeedsAuthenticatorModal
        field={ContactField.Email}
        isVisible={change.isNeedsAuthenticatorVisible}
        onClose={change.closeNeedsAuthenticator}
        onSetAuthenticator={change.setAuthenticator}
        onHidden={change.openRequestedOnboarding}
      />
    </>
  )
}
