import { WatchQueryFetchPolicy } from "@apollo/client"

import { useWalletOverviewScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getBtcWallet, getUsdWallet, getWalletIds } from "@app/graphql/wallets-utils"

type UseCustodialWalletBalancesOptions = {
  skip?: boolean
  fetchPolicy?: WatchQueryFetchPolicy
}

/**
 * The custodial BTC/USD balances every migration surface reads, from the shared
 * wallet-overview query. isReady stays false until the query settles WITH data, so
 * consumers never present unknown balances as zeros. fetchPolicy defaults to the query's
 * cache-first; the commit screen overrides it so the figure the user approves is fresh.
 */
export const useCustodialWalletBalances = ({
  skip = false,
  fetchPolicy,
}: UseCustodialWalletBalancesOptions = {}) => {
  const isAuthed = useIsAuthed()
  const { data, loading, error, refetch } = useWalletOverviewScreenQuery({
    skip: !isAuthed || skip,
    fetchPolicy,
  })

  const wallets = data?.me?.defaultAccount?.wallets

  return {
    btcBalanceSats: getBtcWallet(wallets)?.balance ?? 0,
    usdBalanceCents: getUsdWallet(wallets)?.balance ?? 0,
    walletIds: getWalletIds(wallets),
    isReady: !loading && !error && wallets !== undefined,
    loading,
    hasError: Boolean(error),
    refetch,
  }
}
