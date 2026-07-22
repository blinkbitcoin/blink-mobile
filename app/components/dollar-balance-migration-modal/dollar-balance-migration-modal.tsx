import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type DollarBalanceMigrationModalProps = {
  isVisible: boolean
  toggleModal: () => void
  /**
   * Provided when the user's region permits the in-app Dollar-to-Bitcoin transfer: the
   * primary action then reads "Transfer" and runs it. Omitted when the region does not
   * permit it, so the primary action just closes the modal.
   */
  onTransfer?: () => void
}

export const DollarBalanceMigrationModal: React.FC<DollarBalanceMigrationModalProps> = ({
  isVisible,
  toggleModal,
  onTransfer,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const primaryButtonTitle = onTransfer ? LL.common.transfer() : LL.common.close()
  const primaryButtonOnPress = onTransfer ?? toggleModal

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="warning" size={80} color={colors.warning} />}
      title={LL.AccountMigration.dollarBalanceModal.title()}
      body={
        <Text style={styles.body}>{LL.AccountMigration.dollarBalanceModal.body()}</Text>
      }
      primaryButtonTitle={primaryButtonTitle}
      primaryButtonOnPress={primaryButtonOnPress}
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
