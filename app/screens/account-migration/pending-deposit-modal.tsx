import * as React from "react"

import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"

type PendingDepositModalProps = {
  isVisible: boolean
  /** The OK button lands here, and the close icon and the backdrop too where they are
   *  offered. The caller decides what acknowledging means: leaving the flow, or checking
   *  again where there is no way out. */
  onAcknowledge: () => void
  /** Off where the user cannot leave: OK is then the only action, and the backdrop and the
   *  hardware back do nothing rather than start another check. */
  showCloseIconButton?: boolean
  /** Whether a check started from OK is still running. */
  isChecking?: boolean
  /** Offered where the user cannot leave, so a deposit that never confirms (a low fee
   *  left in the mempool) is not a dead end. */
  onContactSupport?: () => void
  /** The check started from OK found the deposit still confirming. */
  isStillPending?: boolean
}

export const PendingDepositModal: React.FC<PendingDepositModalProps> = ({
  isVisible,
  onAcknowledge,
  showCloseIconButton = true,
  isChecking = false,
  onContactSupport,
  isStillPending = false,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()

  const contactSupportTitle = onContactSupport
    ? LL.AccountMigration.pendingDepositModal.contactSupportCta()
    : undefined

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onAcknowledge}
      image={<GaloyIcon name="warning" size={80} color={colors.warning} />}
      title={LL.AccountMigration.pendingDepositModal.title()}
      body={
        <>
          <Text style={styles.body}>
            {LL.AccountMigration.pendingDepositModal.body()}
          </Text>
          {isStillPending ? (
            <Text style={styles.stillConfirming}>
              {LL.AccountMigration.pendingDepositModal.stillConfirming()}
            </Text>
          ) : null}
        </>
      }
      primaryButtonTitle={LL.common.ok()}
      primaryButtonOnPress={onAcknowledge}
      primaryButtonLoading={isChecking}
      secondaryButtonTitle={contactSupportTitle}
      secondaryButtonOnPress={onContactSupport}
      showCloseIconButton={showCloseIconButton}
      dismissable={showCloseIconButton}
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
  stillConfirming: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    color: colors.warning,
  },
}))
