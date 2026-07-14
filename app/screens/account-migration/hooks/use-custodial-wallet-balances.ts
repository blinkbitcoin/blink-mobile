import { useWalletOverviewScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet, getWalletIds } from "@app/graphql/wallets-utils"

type UseCustodialWalletBalancesOptions = {
  skip?: boolean
}

/**
 * The custodial BTC/USD balances every migration surface reads, from the shared
 * wallet-overview query. isReady stays false until the query settles WITH data, so
 * consumers never present unknown balances as zeros.
 */
export const useCustodialWalletBalances = ({
  skip = false,
}: UseCustodialWalletBalancesOptions = {}) => {
  const isAuthed = useIsAuthed()
  const { data, loading, error } = useWalletOverviewScreenQuery({
    skip: !isAuthed || skip,
  })

  const wallets = data?.me?.defaultAccount?.wallets

  return {
    btcBalanceSats: getBtcWallet(wallets)?.balance ?? 0,
    usdBalanceCents: getUsdWallet(wallets)?.balance ?? 0,
    walletIds: getWalletIds(wallets),
    isReady: !loading && !error && wallets !== undefined,
    loading,
  }
}
