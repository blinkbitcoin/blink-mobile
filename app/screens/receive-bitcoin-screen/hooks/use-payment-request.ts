import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { gql } from "@apollo/client"
import {
  WalletCurrency,
  useLnInvoiceCreateMutation,
  useLnNoAmountInvoiceCreateMutation,
  useLnUsdInvoiceCreateMutation,
  useOnChainAddressCurrentMutation,
} from "@app/graphql/generated"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { BtcWalletDescriptor } from "@app/types/wallets"

import {
  BaseCreatePaymentRequestCreationDataParams,
  Invoice,
  InvoiceType,
  PaymentRequestCreationData,
} from "../payment/index.types"
import { createPaymentRequestCreationData } from "../payment/payment-request-creation-data"
import { useInvoiceLifecycle } from "./use-invoice-lifecycle"
import { useWalletResolution } from "./use-wallet-resolution"

gql`
  mutation lnNoAmountInvoiceCreate($input: LnNoAmountInvoiceCreateInput!) {
    lnNoAmountInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        createdAt
        paymentHash
        paymentRequest
        paymentStatus
        externalId
      }
    }
  }

  mutation lnInvoiceCreate($input: LnInvoiceCreateInput!) {
    lnInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        createdAt
        paymentHash
        paymentRequest
        paymentStatus
        externalId
        satoshis
      }
    }
  }

  mutation lnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {
    lnUsdInvoiceCreate(input: $input) {
      errors {
        message
      }
      invoice {
        createdAt
        paymentHash
        paymentRequest
        paymentStatus
        externalId
        satoshis
      }
    }
  }
`

const DEFAULT_EXPIRATION_MINUTES: Record<WalletCurrency, number> = {
  [WalletCurrency.Btc]: 1440, // 24h
  [WalletCurrency.Usd]: 5,
}

export const usePaymentRequest = () => {
  const wallets = useWalletResolution()

  const [lnNoAmountInvoiceCreate] = useLnNoAmountInvoiceCreateMutation()
  const [lnUsdInvoiceCreate] = useLnUsdInvoiceCreateMutation()
  const [lnInvoiceCreate] = useLnInvoiceCreateMutation()
  const [onChainAddressCurrent] = useOnChainAddressCurrentMutation()

  const [prcd, setPRCD] = useState<PaymentRequestCreationData<WalletCurrency> | null>(
    null,
  )
  const [memoChangeText, setMemoChangeText] = useState<string | null>(null)

  const expirationPerWallet = useRef({ ...DEFAULT_EXPIRATION_MINUTES })

  useLayoutEffect(() => {
    if (prcd !== null || !wallets?.convertMoneyAmount) return

    const { defaultWallet, bitcoinWallet, username, posUrl, lnAddressHostname, network } =
      wallets

    if (!defaultWallet || !bitcoinWallet) return

    const defaultWalletDescriptor = {
      currency: defaultWallet.walletCurrency,
      id: defaultWallet.id,
    }

    const bitcoinWalletDescriptor = {
      currency: bitcoinWallet.walletCurrency,
      id: bitcoinWallet.id,
    } as BtcWalletDescriptor

    const isBtcDefault = defaultWalletDescriptor.currency === WalletCurrency.Btc
    const initialType = username && isBtcDefault ? Invoice.PayCode : Invoice.Lightning

    const initialPRParams: BaseCreatePaymentRequestCreationDataParams<WalletCurrency> = {
      type: initialType,
      defaultWalletDescriptor,
      bitcoinWalletDescriptor,
      convertMoneyAmount: wallets.convertMoneyAmount,
      username: username || undefined,
      posUrl,
      lnAddressHostname,
      network,
      expirationTime: DEFAULT_EXPIRATION_MINUTES[defaultWalletDescriptor.currency],
    }
    setPRCD(createPaymentRequestCreationData(initialPRParams))
  }, [prcd, wallets])

  const mutations = useMemo(
    () => ({
      lnNoAmountInvoiceCreate,
      lnUsdInvoiceCreate,
      lnInvoiceCreate,
      onChainAddressCurrent,
    }),
    [lnNoAmountInvoiceCreate, lnUsdInvoiceCreate, lnInvoiceCreate, onChainAddressCurrent],
  )

  const { pr, regenerateInvoice, expiresInSeconds } = useInvoiceLifecycle(prcd, mutations)

  useEffect(() => {
    if (wallets?.username && wallets.username !== prcd?.username) {
      setPRCD((current) => current && current.setUsername(wallets.username!))
    }
  }, [wallets?.username, prcd?.username])

  const setType = useCallback((type: InvoiceType) => {
    setPRCD((current) => current && current.setType(type))
  }, [])

  const setMemo = useCallback(() => {
    setPRCD((current) => {
      if (current && current.setMemo) {
        return current.setMemo(memoChangeText || "")
      }
      return current
    })
  }, [memoChangeText])

  const switchReceivingWallet = useCallback(
    (type: InvoiceType, walletCurrency: WalletCurrency) => {
      setPRCD((current) => {
        if (!current?.setReceivingWalletDescriptor) return current

        const updated = current.setType(type)
        if (!updated?.setReceivingWalletDescriptor) return updated

        if (
          updated.expirationTime !== undefined &&
          updated.receivingWalletDescriptor.currency !== walletCurrency
        ) {
          expirationPerWallet.current[updated.receivingWalletDescriptor.currency] =
            updated.expirationTime
        }

        const wallet =
          walletCurrency === WalletCurrency.Btc
            ? wallets?.bitcoinWallet
            : wallets?.usdWallet
        if (!wallet) return updated

        const withWallet = updated.setReceivingWalletDescriptor({
          id: wallet.id,
          currency: walletCurrency,
        })

        if (withWallet?.setExpirationTime) {
          return withWallet.setExpirationTime(expirationPerWallet.current[walletCurrency])
        }
        return withWallet ?? updated
      })
    },
    [wallets?.bitcoinWallet, wallets?.usdWallet],
  )

  const setAmount = useCallback((amount: MoneyAmount<WalletOrDisplayCurrency>) => {
    setPRCD((current) => {
      if (current && current.setAmount) {
        return current.setAmount(amount)
      }
      return current
    })
  }, [])

  const setExpirationTime = useCallback((expirationTime: number) => {
    setPRCD((current) => {
      if (current && current.setExpirationTime) {
        expirationPerWallet.current[current.receivingWalletDescriptor.currency] =
          expirationTime
        return current.setExpirationTime(expirationTime)
      }
      return current
    })
  }, [])

  if (!prcd) return null

  return {
    ...prcd,
    ...pr,
    pr,
    setType,
    setMemo,
    switchReceivingWallet,
    setAmount,
    setExpirationTime,
    regenerateInvoice,
    expiresInSeconds,
    memoChangeText,
    setMemoChangeText,
    feesInformation: wallets?.feesInformation,
    btcWalletId: wallets?.bitcoinWallet?.id,
    usdWalletId: wallets?.usdWallet?.id,
    lnAddressHostname: wallets?.lnAddressHostname ?? "",
  }
}
