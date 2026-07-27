import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type UsdbPrivacyWarningModalProps = {
  isVisible: boolean
  /** Dismissing counts as acknowledging: the warning is informational, and re-showing it on
   *  every render of the same screen would make Receive and Transfer unusable. */
  onAcknowledge: () => void
}

export const UsdbPrivacyWarningModal: React.FC<UsdbPrivacyWarningModalProps> = ({
  isVisible,
  onAcknowledge,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onAcknowledge}
      image={<GaloyIcon name="eye" size={80} color={colors.primary} />}
      title={LL.UsdbPrivacyWarning.title()}
      titleMaxWidth="100%"
      body={<Text style={styles.body}>{LL.UsdbPrivacyWarning.body()}</Text>}
      primaryButtonTitle={LL.UsdbPrivacyWarning.acknowledge()}
      primaryButtonOnPress={onAcknowledge}
      showCloseIconButton={true}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    color: colors.black,
  },
}))
