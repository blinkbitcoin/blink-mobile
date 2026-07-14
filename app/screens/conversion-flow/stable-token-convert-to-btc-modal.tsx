import * as React from "react"

import { ConvertToBtcModalUI } from "@app/components/usd-convert-to-btc-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { useI18nContext } from "@app/i18n/i18n-react"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { deactivateStableBalanceAndRefresh } from "@app/self-custodial/stable-balance"
import { toUsdMoneyAmount, UsdMoneyAmount } from "@app/types/amounts"

import { useSelfCustodialConversion } from "./hooks/self-custodial/use-conversion"

type Props = {
  isVisible: boolean
  toggleModal: () => void
  usdWalletBalance: UsdMoneyAmount
  conversionMinimum: number | null
}

/** Converts the full stable-token balance through the same quote/execute pipeline as
 *  the conversion flow, then deactivates Stable Balance so future receives stay in
 *  bitcoin instead of re-trapping into the restricted balance. */
export const StableTokenConvertToBtcModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
  usdWalletBalance,
  conversionMinimum,
}) => {
  const { LL } = useI18nContext()
  const { formatMoneyAmount } = useDisplayCurrency()
  const { isReady } = useActiveWallet()
  const { sdk, refreshWallets, refreshStableBalanceActive } = useSelfCustodialWallet()

  /** Closes first: the funds already moved, and refreshing while still visible would
   *  zero the amount and fire a useless re-quote behind a modal reporting success. */
  const stopRetrappingAndClose = async () => {
    toggleModal()
    if (!sdk) return
    await deactivateStableBalanceAndRefresh({
      sdk,
      refreshWallets,
      refreshStableBalanceActive,
      LL,
    })
  }

  /** Quoting waits for the wallet to finish its startup sync AND for a settled
   *  positive balance: the modal opens right at launch, where a transient zero
   *  balance would fire a below-minimum quote that fails and flashes an error. */
  const hasConvertibleBalance = usdWalletBalance.amount > 0
  const canQuote = isVisible && isReady && hasConvertibleBalance

  const { hasQuoteError, canExecute, execute, requote, loading, errorMessage } =
    useSelfCustodialConversion({
      fromCurrency: WalletCurrency.Usd,
      moneyAmount: usdWalletBalance,
      enabled: canQuote,
      onSuccess: stopRetrappingAndClose,
    })

  /** On a failed quote the button turns into a retry and the modal becomes
   *  escapable; everywhere else it stays locked, so the forced conversion cannot
   *  be skipped while the first quote loads. Closing is never final: the home
   *  trigger re-opens the modal next time the screen gains focus. */
  const convertBalance = hasQuoteError ? requote : execute

  /** The home trigger already gates on the conversion minimum, but the balance
   *  can shrink while the modal is open; an honest minimum beats a generic error
   *  in that residual case. */
  const isBelowConversionMinimum =
    conversionMinimum !== null && usdWalletBalance.amount < conversionMinimum
  const belowMinimumMessage = isBelowConversionMinimum
    ? LL.StableBalance.minimumConversion({
        amount: formatMoneyAmount({ moneyAmount: toUsdMoneyAmount(conversionMinimum) }),
      })
    : undefined
  const quoteFailedMessage = hasQuoteError
    ? belowMinimumMessage ?? LL.errors.generic()
    : undefined
  const displayedErrorMessage = errorMessage ?? quoteFailedMessage
  const isAwaitingQuote = !canExecute && !hasQuoteError
  const isBusy = loading || isAwaitingQuote

  return (
    <ConvertToBtcModalUI
      isVisible={isVisible}
      toggleModal={toggleModal}
      usdWalletBalance={usdWalletBalance}
      onConvert={convertBalance}
      loading={isBusy}
      dismissable={hasQuoteError}
      errorMessage={displayedErrorMessage}
    />
  )
}
