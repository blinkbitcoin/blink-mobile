import { useMemo } from "react"

import {
  Network,
  WalletCurrency,
  useHomeUnauthedQuery,
  useSendBitcoinConfirmationScreenQuery,
  useSendBitcoinDetailsScreenQuery,
} from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import {
  getBtcWallet,
  getDefaultWallet,
  getUsdWallet,
  type WalletBalance,
} from "@app/graphql/wallets-utils"
import { useActiveWallet } from "@app/hooks/use-active-wallet"
import { type WalletState } from "@app/types/wallet.types"

export const toWalletBalances = (wallets: WalletState[]): WalletBalance[] =>
  wallets.map(({ id, balance, walletCurrency }) => ({
    id,
    balance: balance.amount,
    walletCurrency,
  }))

type SendWallets = {
  wallets: readonly WalletBalance[] | undefined
  defaultWallet: WalletBalance | undefined
  btcWallet: WalletBalance | undefined
  usdWallet: WalletBalance | undefined
  network: Network | undefined
  loading: boolean
  isSelfCustodial: boolean
}

export const useSendWallets = (): SendWallets => {
  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial } = activeWallet

  const { data, loading: custodialLoading } = useSendBitcoinDetailsScreenQuery({
    fetchPolicy: "cache-first",
    returnPartialData: true,
    skip: !isAuthed || isSelfCustodial,
  })

  const { data: unauthedData } = useHomeUnauthedQuery({ fetchPolicy: "cache-first" })

  const selfCustodialWallets = useMemo(
    () => toWalletBalances(activeWallet.wallets),
    [activeWallet.wallets],
  )

  if (isSelfCustodial) {
    const btc = selfCustodialWallets.find(
      ({ walletCurrency }) => walletCurrency === WalletCurrency.Btc,
    )
    return {
      wallets: selfCustodialWallets,
      defaultWallet: btc,
      btcWallet: btc,
      usdWallet: selfCustodialWallets.find(
        ({ walletCurrency }) => walletCurrency === WalletCurrency.Usd,
      ),
      network: unauthedData?.globals?.network,
      loading: !activeWallet.isReady,
      isSelfCustodial: true,
    }
  }

  const custodialWallets = data?.me?.defaultAccount?.wallets
  return {
    wallets: custodialWallets,
    defaultWallet: getDefaultWallet(
      custodialWallets,
      data?.me?.defaultAccount?.defaultWalletId,
    ),
    btcWallet: getBtcWallet(custodialWallets),
    usdWallet: getUsdWallet(custodialWallets),
    network: data?.globals?.network ?? unauthedData?.globals?.network,
    loading: custodialLoading,
    isSelfCustodial: false,
  }
}

export const useSendBalances = (): {
  btcWallet: WalletBalance | undefined
  usdWallet: WalletBalance | undefined
} => {
  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial } = activeWallet

  const { data } = useSendBitcoinConfirmationScreenQuery({
    skip: !isAuthed || isSelfCustodial,
  })

  const selfCustodialWallets = useMemo(
    () => toWalletBalances(activeWallet.wallets),
    [activeWallet.wallets],
  )

  if (isSelfCustodial) {
    return {
      btcWallet: selfCustodialWallets.find(
        ({ walletCurrency }) => walletCurrency === WalletCurrency.Btc,
      ),
      usdWallet: selfCustodialWallets.find(
        ({ walletCurrency }) => walletCurrency === WalletCurrency.Usd,
      ),
    }
  }

  return {
    btcWallet: getBtcWallet(data?.me?.defaultAccount?.wallets),
    usdWallet: getUsdWallet(data?.me?.defaultAccount?.wallets),
  }
}
