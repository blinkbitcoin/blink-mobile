import { WalletCurrency } from "@app/graphql/generated"
import {
  BtcMoneyAmount,
  DisplayCurrency,
  UsdMoneyAmount,
  greaterThan,
  isNonZeroMoneyAmount,
  moneyAmountIsCurrencyType,
  toBtcMoneyAmount,
  toDisplayAmount,
  toUsdMoneyAmount,
} from "@app/types/amounts"
import { PaymentType } from "@blinkbitcoin/blink-client"

import {
  AmountInvalidReason,
  AmountStatus,
  ConvertMoneyAmount,
  LimitType,
  PaymentDetail,
} from "./index.types"

/**
 * Hands a payment detail the converter the screen now has.
 *
 * The converter is replaced on every price tick, and then only the rate moves. When the
 * display currency itself changes, which is what entering or leaving sats-only mode does,
 * an amount typed in the old one cannot be read by the new converter: it prices to `NaN`,
 * and the self-custodial details cannot even be built around one. So the amount leaves the
 * old currency before the converter changes. It is carried as the wallet amount it already
 * settles to when the new converter can price that, which keeps the payment's value, and
 * cleared otherwise, by way of zero bitcoin, which every converter can read.
 */
export const withConvertMoneyAmount = <T extends WalletCurrency>(
  paymentDetail: PaymentDetail<T>,
  convertMoneyAmount: ConvertMoneyAmount,
  displayCurrency: string,
): PaymentDetail<T> => {
  const { unitOfAccountAmount, settlementAmount, isSendingMax, setAmount } = paymentDetail
  const isAmountInOtherDisplayCurrency =
    moneyAmountIsCurrencyType(unitOfAccountAmount, DisplayCurrency) &&
    unitOfAccountAmount.currencyCode !== displayCurrency
  if (!isAmountInOtherDisplayCurrency || !setAmount) {
    return paymentDetail.setConvertMoneyAmount(convertMoneyAmount)
  }

  const isSettlementCarried =
    settlementAmount.amount > 0 &&
    Number.isFinite(convertMoneyAmount(settlementAmount, WalletCurrency.Btc).amount)
  if (isSettlementCarried) {
    return setAmount(settlementAmount, isSendingMax).setConvertMoneyAmount(
      convertMoneyAmount,
    )
  }

  const cleared = setAmount(toBtcMoneyAmount(0)).setConvertMoneyAmount(convertMoneyAmount)
  const zeroInDisplayCurrency = toDisplayAmount({
    amount: 0,
    currencyCode: displayCurrency,
  })
  return cleared.setAmount?.(zeroInDisplayCurrency) ?? cleared
}

export const isValidAmount = ({
  paymentDetail,
  usdWalletAmount,
  btcWalletAmount,
  withdrawalLimits,
  intraledgerLimits,
}: {
  paymentDetail?: PaymentDetail<WalletCurrency>
  usdWalletAmount: UsdMoneyAmount
  btcWalletAmount: BtcMoneyAmount
  withdrawalLimits?: readonly {
    readonly __typename: "OneDayAccountLimit"
    readonly totalLimit: number
    readonly remainingLimit?: number | null
    readonly interval?: number | null
  }[]
  intraledgerLimits?: readonly {
    readonly __typename: "OneDayAccountLimit"
    readonly totalLimit: number
    readonly remainingLimit?: number | null
    readonly interval?: number | null
  }[]
}): AmountStatus => {
  if (!paymentDetail || !isNonZeroMoneyAmount(paymentDetail.settlementAmount)) {
    return {
      validAmount: false,
      invalidReason: AmountInvalidReason.NoAmount,
    } as const
  }

  const settlementAmount = paymentDetail.settlementAmount
  if (
    moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Btc) &&
    greaterThan({
      value: settlementAmount,
      greaterThan: btcWalletAmount,
    })
  ) {
    return {
      validAmount: false,
      invalidReason: AmountInvalidReason.InsufficientBalance,
      balance: btcWalletAmount,
    }
  }

  if (
    moneyAmountIsCurrencyType(settlementAmount, WalletCurrency.Usd) &&
    greaterThan({
      value: settlementAmount,
      greaterThan: usdWalletAmount,
    })
  ) {
    return {
      validAmount: false,
      invalidReason: AmountInvalidReason.InsufficientBalance,
      balance: usdWalletAmount,
    }
  }

  const usdAmount = paymentDetail.convertMoneyAmount(
    paymentDetail.unitOfAccountAmount,
    WalletCurrency.Usd,
  )

  if (paymentDetail.paymentType === PaymentType.Intraledger) {
    for (const intraledgerLimit of intraledgerLimits || []) {
      const remainingIntraledgerLimit = intraledgerLimit.remainingLimit
        ? toUsdMoneyAmount(intraledgerLimit.remainingLimit)
        : undefined
      if (
        remainingIntraledgerLimit &&
        greaterThan({
          value: usdAmount,
          greaterThan: remainingIntraledgerLimit,
        })
      ) {
        return {
          validAmount: false,
          invalidReason: AmountInvalidReason.InsufficientLimit,
          remainingLimit: remainingIntraledgerLimit,
          limitType: LimitType.Intraledger,
        }
      }
    }
  } else {
    for (const withdrawalLimit of withdrawalLimits || []) {
      const remainingWithdrawalLimit = withdrawalLimit.remainingLimit
        ? toUsdMoneyAmount(withdrawalLimit.remainingLimit)
        : undefined
      if (
        remainingWithdrawalLimit &&
        greaterThan({
          value: usdAmount,
          greaterThan: remainingWithdrawalLimit,
        })
      ) {
        return {
          validAmount: false,
          invalidReason: AmountInvalidReason.InsufficientLimit,
          remainingLimit: remainingWithdrawalLimit,
          limitType: LimitType.Withdrawal,
        }
      }
    }
  }

  return {
    validAmount: true,
  }
}
