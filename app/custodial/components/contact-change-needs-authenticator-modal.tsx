import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ContactField } from "@app/types/two-factor-enforcement"
import { testProps } from "@app/utils/testProps"

type ContactChangeNeedsAuthenticatorModalProps = {
  field: ContactField
  isVisible: boolean
  /** The X, the backdrop and the Android back: nothing changes. */
  onClose: () => void
  onSetAuthenticator: () => void
  /** Once the modal is off the screen. */
  onHidden: () => void
}

/** Asked before a login method changes on an account with no authenticator: the change
 *  needs its code, so the authenticator comes first. No tier prompt, so closing it
 *  counts no dismissal. */
export const ContactChangeNeedsAuthenticatorModal: React.FC<
  ContactChangeNeedsAuthenticatorModalProps
> = ({ field, isVisible, onClose, onSetAuthenticator, onHidden }) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  const isEmail = field === ContactField.Email
  const title = isEmail
    ? LL.ContactChange.needsAuthenticatorEmailTitle()
    : LL.ContactChange.needsAuthenticatorPhoneTitle()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onClose}
      showCloseIconButton={true}
      image={<GaloyIcon name="lock-closed" size={52} color={colors.primary} />}
      title={title}
      body={
        <>
          <Text style={styles.description}>
            {LL.ContactChange.needsAuthenticatorBody()}
          </Text>
          <Text style={styles.description}>
            {LL.ContactChange.needsAuthenticatorTime()}
          </Text>
        </>
      }
      primaryButtonTitle={LL.TwoFactorEnforcement.setAuthenticator()}
      primaryButtonOnPress={onSetAuthenticator}
      onModalHide={onHidden}
      {...testProps("contact-change-needs-authenticator-modal")}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
    color: colors.black,
    marginBottom: 20,
  },
}))
