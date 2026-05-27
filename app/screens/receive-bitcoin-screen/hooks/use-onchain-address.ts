import { useEffect, useMemo, useState } from "react"

import { WalletCurrency } from "@app/graphql/generated"
import { usePayments } from "@app/hooks/use-payments"
import { useI18nContext } from "@app/i18n/i18n-react"
import { toastShow } from "@app/utils/toast"

import { getPaymentRequestFullUri } from "../payment/helpers"
import { GetFullUriFn, Invoice } from "../payment/index.types"

type UseOnChainAddressOptions = {
  walletCurrency: WalletCurrency
  amount?: number
  memo?: string
}

export const useOnChainAddress = ({
  walletCurrency,
  amount,
  memo,
}: UseOnChainAddressOptions) => {
  const { receiveOnchain } = usePayments()
  const { LL } = useI18nContext()

  const [address, setAddress] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(receiveOnchain))

  useEffect(() => {
    if (!receiveOnchain) return

    setLoading(true)
    receiveOnchain({ walletCurrency })
      .then((result) => {
        if (result.address) setAddress(result.address)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unknown error"
        toastShow({ message, LL, type: "warning" })
      })
      .finally(() => {
        setLoading(false)
      })
  }, [receiveOnchain, walletCurrency, LL])

  const getFullUriFn = useMemo<GetFullUriFn | undefined>(() => {
    if (!address) return undefined
    return ({ uppercase, prefix }) =>
      getPaymentRequestFullUri({
        type: Invoice.OnChain,
        input: address,
        amount,
        memo,
        uppercase,
        prefix,
      })
  }, [address, amount, memo])

  return { address, loading, getFullUriFn }
}
