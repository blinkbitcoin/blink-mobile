import * as React from "react"
import { Text } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type Props = {
  isVisible: boolean
  toggleModal: () => void
}

export const StableTokenRestrictionModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="info" size={80} color={colors.primary} />}
      title={LL.StableTokenRestriction.modalTitle()}
      titleMaxWidth="100%"
      body={<Text style={styles.body}>{LL.StableTokenRestriction.modalBody()}</Text>}
      primaryButtonTitle={LL.common.close()}
      primaryButtonOnPress={toggleModal}
      showCloseIconButton={true}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 8,
    color: colors.black,
    textAlign: "center",
  },
}))
