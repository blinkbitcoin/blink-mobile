import * as React from "react"
import { Text } from "react-native"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type Props = {
  isVisible: boolean
  toggleModal: () => void
}

export const StablesatsRestrictionModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()
  const styles = useStyles()
  const { isSelfCustodial } = useActiveWallet()

  const title = isSelfCustodial
    ? LL.StablesatsRestriction.modalTitleSelfCustodial()
    : LL.StablesatsRestriction.modalTitle()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="info" size={100} color={colors.primary3} />}
      title={title}
      titleMaxWidth="100%"
      body={<Text style={styles.body}>{LL.StablesatsRestriction.modalBody()}</Text>}
      primaryButtonTitle={LL.common.okay()}
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
