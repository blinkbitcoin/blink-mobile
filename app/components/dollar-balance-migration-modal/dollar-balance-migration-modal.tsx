import * as React from "react"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { useI18nContext } from "@app/i18n/i18n-react"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import CustomModal from "../custom-modal/custom-modal"

type DollarBalanceMigrationModalProps = {
  isVisible: boolean
  toggleModal: () => void
  /** Runs the in-app dollar-to-bitcoin conversion: the modal's only action, since emptying
   *  the dollar balance is the one way forward and every affected user, restricted regions
   *  included, can now do it here. The corner close still dismisses the modal. */
  onTransfer: () => void
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

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={toggleModal}
      image={<GaloyIcon name="warning" size={80} color={colors.warning} />}
      title={LL.AccountMigration.dollarBalanceModal.title()}
      body={
        <Text style={styles.body}>{LL.AccountMigration.dollarBalanceModal.body()}</Text>
      }
      primaryButtonTitle={LL.common.transfer()}
      primaryButtonOnPress={onTransfer}
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
