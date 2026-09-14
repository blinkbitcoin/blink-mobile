import * as React from "react"

import { DollarBalanceMigrationModal } from "@app/components/dollar-balance-migration-modal"
import { useI18nContext } from "@app/i18n/i18n-react"

type AnonModeConvertModalProps = {
  isVisible: boolean
  toggleModal: () => void
  /** Runs the dollar-to-bitcoin conversion, the one way into Anon Mode. */
  onTransfer: () => void
}

export const AnonModeConvertModal: React.FC<AnonModeConvertModalProps> = ({
  isVisible,
  toggleModal,
  onTransfer,
}) => {
  const { LL } = useI18nContext()

  return (
    <DollarBalanceMigrationModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      onTransfer={onTransfer}
      title={LL.AnonModeConvertModal.title()}
      body={LL.AnonModeConvertModal.body()}
    />
  )
}
