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
 * consumers never present unknown balances as zeros. isSkipped marks a query that never
 * ran, which a consumer must not read as an empty answer; hasConnectionIssue separates a
 * failure the network caused (retrying can still resolve) from one the server answered,
 * while hasError flags any error at all so a gate blocks rather than waving the user in;
 * refetch is what a caller offering a retry calls. fetchPolicy defaults to the query's
 * cache-first; the commit screen overrides it so the figure the user approves is fresh.
 */
export const useCustodialWalletBalances = ({
  skip = false,
  fetchPolicy,
}: UseCustodialWalletBalancesOptions = {}) => {
  const isAuthed = useIsAuthed()
  const isSkipped = !isAuthed || skip

  /** notifyOnNetworkStatusChange reopens `loading` for a refetch, so a caller offering a
   *  retry can show it running instead of leaving the screen unchanged for seconds. */
  const { data, loading, error, refetch } = useWalletOverviewScreenQuery({
    skip: isSkipped,
    notifyOnNetworkStatusChange: true,
    fetchPolicy,
  })

  const wallets = data?.me?.defaultAccount?.wallets

  return {
    btcBalanceSats: getBtcWallet(wallets)?.balance ?? 0,
    usdBalanceCents: getUsdWallet(wallets)?.balance ?? 0,
    walletIds: getWalletIds(wallets),
    isReady: !loading && !error && wallets !== undefined,
    isSkipped,
    hasConnectionIssue: Boolean(error?.networkError),
    hasError: Boolean(error),
    loading,
    refetch,
  }
}
