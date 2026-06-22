import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type Props = {
  isVisible: boolean
  toggleModal: () => void
}

export const DollarBalanceRestrictionModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="info" size={80} color={colors.primary} />}
      title={LL.DollarBalanceRestriction.modalTitle()}
      titleMaxWidth="100%"
      body={null}
      primaryButtonTitle={LL.common.close()}
      primaryButtonOnPress={toggleModal}
      showCloseIconButton={true}
    />
  )
}
