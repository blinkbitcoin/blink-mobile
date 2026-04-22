import React from "react"
import { View } from "react-native"

import { makeStyles, Text } from "@rn-vui/themed"

import CustomModal from "@app/components/custom-modal/custom-modal"
import { useI18nContext } from "@app/i18n/i18n-react"
import { ConversionFeeRow } from "@app/screens/conversion-flow/conversion-fee-row"
import { testProps } from "@app/utils/testProps"

type Props = {
  isVisible: boolean
  isActivating: boolean
  feeText: string
  adjustmentText: string | null
  isLoading: boolean
  hasError: boolean
  showFeeRow: boolean
  deactivationWarning?: string
  isSubmitting: boolean
  onConfirm: () => void
  onCancel: () => void
}

export const StableBalanceConfirmModal: React.FC<Props> = ({
  isVisible,
  isActivating,
  feeText,
  adjustmentText,
  isLoading,
  hasError,
  showFeeRow,
  deactivationWarning,
  isSubmitting,
  onConfirm,
  onCancel,
}) => {
  const { LL } = useI18nContext()
  const styles = useStyles()

  const title = isActivating
    ? LL.StableBalance.toggleModal.activateTitle()
    : LL.StableBalance.toggleModal.deactivateTitle()

  const body = isActivating
    ? LL.StableBalance.toggleModal.activateBody()
    : LL.StableBalance.toggleModal.deactivateBody()

  const confirmTitle = isActivating
    ? LL.StableBalance.toggleModal.activateConfirm()
    : LL.StableBalance.toggleModal.deactivateConfirm()

  return (
    <CustomModal
      isVisible={isVisible}
      toggleModal={onCancel}
      title={title}
      body={
        <View {...testProps("stable-balance-confirm-modal")}>
          <Text type="p1" style={styles.body}>
            {body}
          </Text>
          {deactivationWarning ? (
            <Text type="p2" style={styles.warning}>
              {deactivationWarning}
            </Text>
          ) : null}
          {showFeeRow ? (
            <View style={styles.feeRowWrapper}>
              <ConversionFeeRow
                feeText={feeText}
                adjustmentText={adjustmentText}
                isLoading={isLoading}
                hasError={hasError}
              />
            </View>
          ) : null}
        </View>
      }
      primaryButtonTitle={confirmTitle}
      primaryButtonOnPress={onConfirm}
      primaryButtonLoading={isSubmitting}
      primaryButtonDisabled={isSubmitting || isLoading}
      secondaryButtonTitle={LL.StableBalance.toggleModal.cancel()}
      secondaryButtonOnPress={onCancel}
    />
  )
}

const useStyles = makeStyles(({ colors }) => ({
  body: {
    marginBottom: 12,
  },
  warning: {
    color: colors.warning,
    marginBottom: 12,
  },
  feeRowWrapper: {
    marginHorizontal: -20,
  },
}))
