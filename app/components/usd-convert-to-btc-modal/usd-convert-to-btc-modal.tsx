import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { UsdMoneyAmount } from "@app/types/amounts"
import { useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

import { UsdConvertAmountRows } from "./usd-convert-amount-rows"

type Props = {
  isVisible: boolean
  toggleModal: () => void
  usdWalletBalance: UsdMoneyAmount
}

export const UsdConvertToBtcModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
  usdWalletBalance,
}) => {
  const { LL } = useI18nContext()
  const {
    theme: { colors },
  } = useTheme()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="clock" size={80} color={colors.primary3} />}
      title={LL.ConvertDollarToBitcoinModal.title()}
      titleMaxWidth="100%"
      body={<UsdConvertAmountRows usdWalletBalance={usdWalletBalance} />}
      primaryButtonTitle={LL.ConvertDollarToBitcoinModal.approve()}
      primaryButtonOnPress={toggleModal}
      showCloseIconButton={true}
    />
  )
}
