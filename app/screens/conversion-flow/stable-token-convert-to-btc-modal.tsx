import * as React from "react"
import { useState } from "react"

import { ConvertToBtcModalUI } from "@app/components/usd-convert-to-btc-modal"
import { WalletCurrency } from "@app/graphql/generated"
import { useInFlightGuard } from "@app/hooks/use-in-flight-guard"
import { useI18nContext } from "@app/i18n/i18n-react"
import { deactivateStableBalance } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import { UsdMoneyAmount } from "@app/types/amounts"
import { reportError } from "@app/utils/error-logging"

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
  const { sdk, refreshWallets, refreshStableBalanceActive } = useSelfCustodialWallet()
  const guard = useInFlightGuard()
  const [isFinishing, setIsFinishing] = useState(false)

  /** The funds already moved, so deactivation or refresh failures must not keep the
   *  user blocked behind the non-dismissable modal. */
  const stopRetrappingAndClose = async () => {
    setIsFinishing(true)
    try {
      if (sdk) {
        await deactivateStableBalance(sdk).catch((err) =>
          reportError("Stable token forced conversion deactivate", err),
        )
      }
      await Promise.all([refreshStableBalanceActive(), refreshWallets()]).catch((err) =>
        reportError("Stable token forced conversion refresh", err),
      )
      toggleModal()
    } catch (err) {
      reportError("Stable token forced conversion close", err)
    } finally {
      setIsFinishing(false)
    }
  }

  const { isQuoting, hasQuoteError, canExecute, execute, loading, errorMessage } =
    useSelfCustodialConversion({
      fromCurrency: WalletCurrency.Usd,
      moneyAmount: usdWalletBalance,
      enabled: isVisible,
      onSuccess: stopRetrappingAndClose,
    })

  const convertBalance = () => guard.run(execute)

  /** A failed quote in a non-dismissable modal must still tell the user something. */
  const quoteFailedMessage = hasQuoteError ? LL.errors.generic() : undefined
  const displayedErrorMessage = errorMessage ?? quoteFailedMessage
  const isBusy = loading || isFinishing || isQuoting

  return (
    <ConvertToBtcModalUI
      isVisible={isVisible}
      toggleModal={toggleModal}
      usdWalletBalance={usdWalletBalance}
      onConvert={convertBalance}
      loading={isBusy}
      disabled={!canExecute}
      errorMessage={displayedErrorMessage}
    />
  )
}
