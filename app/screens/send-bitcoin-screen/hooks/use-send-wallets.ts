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
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { getSelfCustodialDefaultCurrency } from "@app/store/persistent-state/self-custodial-default-currency"
import { type WalletState } from "@app/types/wallet"

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

const restrictToBitcoinWhenBlocked = (
  result: SendWallets,
  blocked: boolean,
): SendWallets =>
  blocked && result.btcWallet
    ? {
        ...result,
        wallets: [result.btcWallet],
        defaultWallet: result.btcWallet,
        usdWallet: undefined,
      }
    : result

export const useSendWallets = (): SendWallets => {
  const isAuthed = useIsAuthed()
  const activeWallet = useActiveWallet()
  const { isSelfCustodial } = activeWallet
  const { persistentState } = usePersistentStateContext()
  const isDollarBalanceRestricted = useDollarBalanceRestricted()

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
    const usd = selfCustodialWallets.find(
      ({ walletCurrency }) => walletCurrency === WalletCurrency.Usd,
    )
    const preferred = getSelfCustodialDefaultCurrency(persistentState)
    const defaultWallet = preferred === WalletCurrency.Usd ? usd ?? btc : btc
    const result: SendWallets = {
      wallets: selfCustodialWallets,
      defaultWallet,
      btcWallet: btc,
      usdWallet: usd,
      network: unauthedData?.globals?.network,
      loading: !activeWallet.isReady,
      isSelfCustodial: true,
    }
    return restrictToBitcoinWhenBlocked(result, isDollarBalanceRestricted)
  }

  const custodialWallets = data?.me?.defaultAccount?.wallets
  const result: SendWallets = {
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
  return restrictToBitcoinWhenBlocked(result, isDollarBalanceRestricted)
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
