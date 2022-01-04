import useToken from "../utils/use-token"
import { useMySubscription } from "./user-hooks"
import useMainQuery from "./use-main-query"

export const useWalletBalance = (): {
  walletId?: string
  satBalance: number
  usdBalance: number | string
  loading: boolean
} => {
  const { convertCurrencyAmount, currentBalance, mySubscriptionLoading } =
    useMySubscription()
  const { btcWalletBalance, btcWalletId, refetch: refetchMainQuery } = useMainQuery()

  const { hasToken } = useToken()

  if (!hasToken) {
    return {
      satBalance: 0,
      usdBalance: 0,
      loading: false,
    }
  }

  if (currentBalance && currentBalance !== btcWalletBalance) {
    refetchMainQuery()
  }

  return {
    walletId: btcWalletId,
    satBalance: btcWalletBalance,
    usdBalance:
      btcWalletBalance > 0
        ? convertCurrencyAmount({ amount: btcWalletBalance, from: "BTC", to: "USD" })
        : 0,
    loading: mySubscriptionLoading,
  }
}
