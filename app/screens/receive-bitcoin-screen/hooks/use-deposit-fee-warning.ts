import { useCallback } from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { useI18nContext } from "@app/i18n/i18n-react"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { DepositFeeWarning, getDepositFeeWarning } from "@app/utils/deposit-fees"

import { ReceivePaymentRequestState } from "../payment/request-state.types"

type AmountWarning = (amount: MoneyAmount<WalletOrDisplayCurrency>) => string | undefined

/**
 * The amount sheet's warning for a custodial onchain receive whose amount the
 * flat deposit fee would swallow (blink-wip#1261). It reads the typed amount
 * in sats, so a display-currency amount is converted on every keystroke.
 * Under the backend's minimum, or at or under the fee, the deposit never
 * arrives; under `depositFeeWarningMultiplier` fees it arrives with most gone. Self-custodial deposits carry no `feesInformation` and never warn.
 */
export const useDepositFeeWarning = (
  requestState: ReceivePaymentRequestState,
  enabled: boolean,
): AmountWarning | undefined => {
  const { LL } = useI18nContext()
  const { depositFeeWarningMultiplier, onchainDepositMinimumSats } = useRemoteConfig()
  const { convertMoneyAmount, feesInformation } = requestState
  const deposit = feesInformation?.deposit

  const getAmountWarning = useCallback<AmountWarning>(
    (amount) => {
      const warning = getDepositFeeWarning({
        amountSats: convertMoneyAmount(amount, WalletCurrency.Btc).amount,
        deposit,
        minimumSats: onchainDepositMinimumSats,
        multiplier: depositFeeWarningMultiplier,
      })
      if (!warning) return undefined
      switch (warning.type) {
        case DepositFeeWarning.BelowMinimum:
          return LL.ReceiveScreen.depositBelowMinimum({
            min: warning.minimum.toLocaleString("en-US"),
          })
        case DepositFeeWarning.AllConsumedByFee:
          return LL.ReceiveScreen.depositBelowFee()
        case DepositFeeWarning.ConsumedByFee:
          return LL.ReceiveScreen.depositConsumedByFee({
            fee: warning.fee.toLocaleString("en-US"),
          })
      }
    },
    [
      convertMoneyAmount,
      deposit,
      onchainDepositMinimumSats,
      depositFeeWarningMultiplier,
      LL,
    ],
  )

  return enabled ? getAmountWarning : undefined
}
