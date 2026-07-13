import * as React from "react"

import { ConvertToBtcModalUI } from "@app/components/usd-convert-to-btc-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { useI18nContext } from "@app/i18n/i18n-react"
import { deactivateStableBalance } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { UsdMoneyAmount } from "@app/types/amounts"
import { reportError } from "@app/utils/error-logging"
import { toastShow } from "@app/utils/toast"

import { useSelfCustodialConversion } from "./hooks/self-custodial/use-conversion"

type Props = {
  isVisible: boolean
  toggleModal: () => void
  usdWalletBalance: UsdMoneyAmount
}

/** Converts the full stable-token balance through the same quote/execute pipeline as
 *  the conversion flow, then deactivates Stable Balance so future receives stay in
 *  bitcoin instead of re-trapping into the restricted balance. */
export const StableTokenConvertToBtcModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
  usdWalletBalance,
}) => {
  const { LL } = useI18nContext()
  const { isReady } = useActiveWallet()
  const { sdk, refreshWallets, refreshStableBalanceActive } = useSelfCustodialWallet()

  /** Closes first: the funds already moved, and refreshing while still visible would
   *  zero the amount and fire a useless re-quote behind a modal reporting success. */
  const stopRetrappingAndClose = async () => {
    toggleModal()
    if (sdk) {
      await deactivateStableBalance(sdk).catch((err) => {
        reportError("Stable token forced conversion deactivate", err)
        toastShow({
          message: (tr) => tr.StableBalance.toggleFailedToast(),
          LL,
          type: "error",
        })
      })
    }
    await Promise.all([refreshStableBalanceActive(), refreshWallets()]).catch((err) =>
      reportError("Stable token forced conversion refresh", err),
    )
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

  /** On a failed quote the button turns into a retry, and the modal only locks while
   *  a conversion is actually executable, so no unquotable state strands the user. */
  const convertBalance = hasQuoteError ? requote : execute
  const quoteFailedMessage = hasQuoteError ? LL.errors.generic() : undefined
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
      dismissable={!canExecute}
      errorMessage={displayedErrorMessage}
    />
  )
}
