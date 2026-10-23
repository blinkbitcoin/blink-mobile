import React from "react"

import { IconNamesType } from "@app/components/atomic/galoy-icon"
import { ContactChangeNeedsAuthenticatorModal } from "@app/custodial/components/contact-change-needs-authenticator-modal"
import { useContactChange } from "@app/custodial/hooks/use-contact-change"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { ContactField } from "@app/types/two-factor-enforcement"
import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { SettingsRow } from "../../row"
import { useLoginMethods } from "../login-methods-hook"

/**
 * The login phone number: added from the row, and changed from its pen while the email
 * keeps the account reachable, since the server changes it by removing it and adding
 * the new one. Nothing is offered on it while it is the account's only login method.
 */
export const PhoneSetting: React.FC = () => {
  const { LL } = useI18nContext()
  const { navigate } = useNavigation<NativeStackNavigationProp<RootStackParamList>>()

  const { loading, phone, phoneVerified, bothEmailAndPhoneVerified, hasAuthenticator } =
    useLoginMethods()
  const change = useContactChange(ContactField.Phone, hasAuthenticator)

  const addPhone = () => navigate("phoneRegistrationInitiate")

  const title = phoneVerified ? phone || "" : LL.AccountScreen.tapToAddPhoneNumber()
  const rowAction = phoneVerified ? null : addPhone
  const changeIcon: IconNamesType | null = bothEmailAndPhoneVerified ? "pencil" : null
  const rightIcon = phoneVerified ? changeIcon : "caret-right"
  const rightIconAction = bothEmailAndPhoneVerified ? change.startChange : undefined

  return (
    <>
      <SettingsRow
        loading={loading}
        title={title}
        leftGaloyIcon="phone"
        action={rowAction}
        rightIcon={rightIcon}
        rightIconAction={rightIconAction}
      />
      <ContactChangeNeedsAuthenticatorModal
        field={ContactField.Phone}
        isVisible={change.isNeedsAuthenticatorVisible}
        onClose={change.closeNeedsAuthenticator}
        onSetAuthenticator={change.setAuthenticator}
        onHidden={change.openRequestedOnboarding}
      />
    </>
  )
}
