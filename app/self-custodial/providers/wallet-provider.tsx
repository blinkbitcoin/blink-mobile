import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { SdkEvent_Tags as SdkEventTags } from "@breeztech/breez-sdk-spark-react-native"

import { useFeatureFlags } from "@app/config/feature-flags-context"
import { WalletCurrency } from "@app/graphql/generated"
import { toBtcMoneyAmount, toUsdMoneyAmount } from "@app/types/amounts"
import {
  AccountType,
  ActiveWalletStatus,
  toWalletId,
  type ActiveWalletState,
  type WalletState,
} from "@app/types/wallet.types"
import KeyStoreWrapper from "@app/utils/storage/secureStorage"

import { disconnectSdk, initSdk } from "../bridge"
import { SparkToken } from "../config"
import { logSdkEvent, SdkLogLevel } from "../logging"
import { mapSelfCustodialTransactions } from "../mappers/transaction-mapper"

type SelfCustodialWalletContextValue = ActiveWalletState & {
  retry: () => void
}

const defaultState: SelfCustodialWalletContextValue = {
  wallets: [],
  status: ActiveWalletStatus.Unavailable,
  accountType: AccountType.SelfCustodial,
  retry: () => {},
}

const SelfCustodialWalletContext =
  createContext<SelfCustodialWalletContextValue>(defaultState)

export const SelfCustodialWalletProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const { nonCustodialEnabled } = useFeatureFlags()
  const [wallets, setWallets] = useState<WalletState[]>([])
  const [status, setStatus] = useState<ActiveWalletStatus>(ActiveWalletStatus.Unavailable)
  const [retryCount, setRetryCount] = useState(0)
  const sdkRef = useRef<Awaited<ReturnType<typeof initSdk>> | null>(null)

  const refreshWallets = useCallback(async () => {
    if (!sdkRef.current) return

    try {
      const info = await sdkRef.current.getInfo({ ensureSynced: false })
      const identityPubkey = info.identityPubkey

      const btcBalance = Number(info.balanceSats)
      const usdbEntry = Object.entries(info.tokenBalances).find(
        ([, token]) => token.tokenMetadata?.ticker === SparkToken.Ticker,
      )
      const usdBalance = usdbEntry ? Number(usdbEntry[1].balance) : 0

      const btcWallet: WalletState = {
        id: toWalletId(`${identityPubkey}-btc`),
        walletCurrency: WalletCurrency.Btc,
        balance: toBtcMoneyAmount(btcBalance),
        transactions: [],
      }

      const usdWallet: WalletState = {
        id: toWalletId(`${identityPubkey}-usd`),
        walletCurrency: WalletCurrency.Usd,
        balance: toUsdMoneyAmount(Number(usdBalance)),
        transactions: [],
      }

      const payments = await sdkRef.current.listPayments({
        typeFilter: undefined,
        statusFilter: undefined,
        assetFilter: undefined,
        paymentDetailsFilter: undefined,
        fromTimestamp: undefined,
        toTimestamp: undefined,
        offset: undefined,
        limit: 50,
        sortAscending: false,
      })

      const txs = mapSelfCustodialTransactions(payments.payments)
      const btcTxs = txs.filter((tx) => tx.amount.currency === WalletCurrency.Btc)
      const usdTxs = txs.filter((tx) => tx.amount.currency === WalletCurrency.Usd)

      setWallets([
        { ...btcWallet, transactions: btcTxs },
        { ...usdWallet, transactions: usdTxs },
      ])
      setStatus(ActiveWalletStatus.Ready)
    } catch (err) {
      logSdkEvent(SdkLogLevel.Error, `Failed to refresh wallets: ${err}`)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      const hasMnemonic = await KeyStoreWrapper.hasMnemonic()
      if (!hasMnemonic || !nonCustodialEnabled) {
        if (mounted) setStatus(ActiveWalletStatus.Unavailable)
        return
      }

      if (mounted) setStatus(ActiveWalletStatus.Loading)

      try {
        const mnemonic = await KeyStoreWrapper.getMnemonic()
        if (!mnemonic) {
          if (mounted) setStatus(ActiveWalletStatus.Unavailable)
          return
        }

        const sdk = await initSdk(mnemonic)
        if (!mounted) {
          await disconnectSdk(sdk)
          return
        }

        sdkRef.current = sdk

        await sdk.addEventListener({
          onEvent: async (event) => {
            if (!mounted) return
            if (
              event.tag === SdkEventTags.Synced ||
              event.tag === SdkEventTags.PaymentSucceeded ||
              event.tag === SdkEventTags.PaymentPending ||
              event.tag === SdkEventTags.ClaimedDeposits ||
              event.tag === SdkEventTags.UnclaimedDeposits
            ) {
              await refreshWallets()
            }
          },
        })

        await refreshWallets()
      } catch (err) {
        logSdkEvent(SdkLogLevel.Error, `SDK init failed: ${err}`)
        if (mounted) setStatus(ActiveWalletStatus.Error)
      }
    }

    initialize()

    return () => {
      mounted = false
      if (sdkRef.current) {
        disconnectSdk(sdkRef.current)
        sdkRef.current = null
      }
    }
  }, [nonCustodialEnabled, retryCount, refreshWallets])

  const retry = useCallback(() => {
    setRetryCount((prev) => prev + 1)
  }, [])

  const value = useMemo(
    (): SelfCustodialWalletContextValue => ({
      wallets,
      status,
      accountType: AccountType.SelfCustodial,
      retry,
    }),
    [wallets, status, retry],
  )

  return (
    <SelfCustodialWalletContext.Provider value={value}>
      {children}
    </SelfCustodialWalletContext.Provider>
  )
}

export const useSelfCustodialWallet = (): SelfCustodialWalletContextValue =>
  useContext(SelfCustodialWalletContext)
