import React from "react"

import { makeStyles, Text } from "@rn-vui/themed"

import { useI18nContext } from "@app/i18n/i18n-react"
import { DepositErrorReason, type PendingDeposit } from "@app/types/payment"

type Props = {
  deposit: PendingDeposit
}

export const DepositErrorMessage: React.FC<Props> = ({ deposit }) => {
  const styles = useStyles()
  const { LL } = useI18nContext()
  const { errorReason, requiredFeeSats, errorMessage } = deposit

  if (!errorReason) return null

  if (errorReason === DepositErrorReason.FeeExceeded) {
    return (
      <Text style={styles.warningText}>
        {LL.UnclaimedDeposit.feeExceeded({ requiredFee: requiredFeeSats ?? 0 })}
      </Text>
    )
  }

  if (errorReason === DepositErrorReason.BelowDust) {
    return <Text style={styles.warningText}>{LL.UnclaimedDeposit.belowDustLimit()}</Text>
  }

  if (errorReason === DepositErrorReason.MissingUtxo) {
    return <Text style={styles.errorText}>{LL.UnclaimedDeposit.missingUtxo()}</Text>
  }

  return (
    <Text style={styles.errorText}>
      {LL.UnclaimedDeposit.genericError({
        error: errorMessage ?? LL.UnclaimedDeposit.error(),
      })}
    </Text>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  warningText: {
    fontSize: 12,
    color: colors._orange,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
  },
}))
