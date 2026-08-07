import * as React from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { useIntraLedgerConversion } from "@app/hooks/use-intra-ledger-conversion"
import { UsdMoneyAmount } from "@app/types/amounts"

import { ConvertToBtcModalUI } from "./convert-to-btc-modal-ui"

type Props = {
  isVisible: boolean
  toggleModal: () => void
  usdWalletBalance: UsdMoneyAmount
  usdWalletId: string
  btcWalletId: string
}

export const UsdConvertToBtcModal: React.FC<Props> = ({
  isVisible,
  toggleModal,
  usdWalletBalance,
  usdWalletId,
  btcWalletId,
}) => {
  const { execute, loading, errorMessage } = useIntraLedgerConversion({
    onSuccess: toggleModal,
  })

  const convertBalance = () =>
    execute({
      fromWallet: { id: usdWalletId, currency: WalletCurrency.Usd },
      toWallet: { id: btcWalletId, currency: WalletCurrency.Btc },
      fromAmount: usdWalletBalance.amount,
    })

  return (
    <ConvertToBtcModalUI
      isVisible={isVisible}
      toggleModal={toggleModal}
      usdWalletBalance={usdWalletBalance}
      onConvert={convertBalance}
      loading={loading}
      errorMessage={errorMessage}
    />
  )
}
