import { WalletCurrency } from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useTranslateSdkError } from "@app/self-custodial/hooks"
import { isSelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import { DisplayCurrency, ZeroUsdMoneyAmount } from "@app/types/amounts"

import { PaymentDetail } from "../payment-details/index.types"
import { FeeType } from "../use-fee"

type ReviewFeeText = {
  /** The Fee row: display and wallet amounts, led like the hero. */
  feeDisplayText: string
  /** The receipt's fee in the display currency, and in sats when that differs. */
  currencyFeeAmount: string
  satFeeAmount: string
  /** The classified reason a quote failed, and the text review shows for it. */
  feeErrorCode?: string
  feeErrorText: string
}

/**
 * The fee as review writes it. Until a quote lands, every text is the fee error.
 *
 * Self-custodial fee failures carry a classified SDK code; custodial ones carry raw
 * GraphQL text that is not fit to show, so only the former replaces the generic string.
 */
export const useReviewFeeText = ({
  fee,
  paymentDetail,
  leadsWithWalletCurrency,
}: {
  fee: FeeType
  paymentDetail: PaymentDetail<WalletCurrency>
  leadsWithWalletCurrency: boolean
}): ReviewFeeText => {
  const { LL } = useI18nContext()
  const translateSdkError = useTranslateSdkError()
  const {
    formatDisplayAndWalletAmount,
    getSecondaryAmountIfCurrencyIsDifferent,
    formatMoneyAmount,
  } = useDisplayCurrency()

  const feeErrorCode = fee.status === "error" ? fee.errors?.[0]?.message : undefined
  const feeErrorText =
    (isSelfCustodialErrorCode(feeErrorCode)
      ? translateSdkError(feeErrorCode)
      : undefined) ?? String(LL.common.feeError())

  if (!fee.amount) {
    return {
      feeDisplayText: feeErrorText,
      currencyFeeAmount: feeErrorText,
      satFeeAmount: feeErrorText,
      feeErrorCode,
      feeErrorText,
    }
  }

  const { convertMoneyAmount, sendingWalletDescriptor } = paymentDetail
  const feeDisplayAmount = convertMoneyAmount(fee.amount, DisplayCurrency)
  const feeWalletAmount = convertMoneyAmount(fee.amount, sendingWalletDescriptor.currency)
  const secondaryFeeAmount = getSecondaryAmountIfCurrencyIsDifferent({
    primaryAmount: feeDisplayAmount,
    walletAmount: convertMoneyAmount(fee.amount, WalletCurrency.Btc),
    displayAmount: feeDisplayAmount,
  })

  return {
    feeDisplayText: formatDisplayAndWalletAmount({
      primaryAmount: leadsWithWalletCurrency ? feeWalletAmount : feeDisplayAmount,
      displayAmount: feeDisplayAmount,
      walletAmount: feeWalletAmount,
    }),
    currencyFeeAmount: formatMoneyAmount({ moneyAmount: feeDisplayAmount }),
    satFeeAmount: formatMoneyAmount({
      moneyAmount: secondaryFeeAmount ?? ZeroUsdMoneyAmount,
    }),
    feeErrorCode,
    feeErrorText,
  }
}
