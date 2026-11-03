import React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { testProps } from "@app/utils/testProps"

type TwoFactorTurnOffModalProps = {
  isVisible: boolean
  /** Keep me protected, the X, the backdrop and the Android back: nothing changes. */
  onKeepProtected: () => void
  /** On to the authenticator's code, which turns it off. */
  onContinue: () => void
  /** Once the modal is off the screen. */
  onHidden?: () => void
}

/** Asked before the authenticator is turned off where it is not mandatory: it can be,
 *  but Blink recommends against it. */
export const TwoFactorTurnOffModal: React.FC<TwoFactorTurnOffModalProps> = ({
  isVisible,
  onKeepProtected,
  onContinue,
  onHidden,
}) => {
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const { LL } = useI18nContext()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onKeepProtected}
      showCloseIconButton={true}
      image={<GaloyIcon name="info" size={52} color={colors.primary} />}
      title={LL.TwoFactorTurnOff.modalTitle()}
      body={<Text style={styles.description}>{LL.TwoFactorTurnOff.modalBody()}</Text>}
      primaryButtonTitle={LL.TwoFactorTurnOff.keepProtected()}
      primaryButtonOnPress={onKeepProtected}
      secondaryButtonTitle={LL.common.continue()}
      secondaryButtonOnPress={onContinue}
      onModalHide={onHidden}
      {...testProps("two-factor-turn-off-modal")}
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
