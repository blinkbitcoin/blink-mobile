import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { Text, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type Props = {
  isVisible: boolean
  toggleModal: () => void
  /** The gate closed without a region behind it: the server never answered. The modal
   *  then owes the user a way to ask again, not a verdict nobody reached. */
  isRegionUnknown?: boolean
}

export const DollarBalanceRestrictionModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
  isRegionUnknown = false,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  const title = isRegionUnknown
    ? LL.DollarBalanceRestriction.unknownRegionModalTitle()
    : LL.DollarBalanceRestriction.modalTitle()
  const body = isRegionUnknown ? (
    <Text type="p2">{LL.DollarBalanceRestriction.unknownRegionModalBody()}</Text>
  ) : null

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="info" size={80} color={colors.primary} />}
      title={title}
      titleMaxWidth="100%"
      body={body}
      primaryButtonTitle={LL.common.close()}
      primaryButtonOnPress={toggleModal}
      showCloseIconButton={true}
    />
  )
}
