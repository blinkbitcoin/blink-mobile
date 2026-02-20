import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import ReactNativeHapticFeedback from "react-native-haptic-feedback"

import {
  WalletCurrency,
  useLnInvoiceCreateMutation,
  useLnNoAmountInvoiceCreateMutation,
  useLnUsdInvoiceCreateMutation,
  useOnChainAddressCurrentMutation,
} from "@app/graphql/generated"
import { useLnUpdateHashPaid } from "@app/graphql/ln-update-context"
import { useCountdown } from "@app/hooks"
import { MoneyAmount, WalletOrDisplayCurrency } from "@app/types/amounts"
import { BtcWalletDescriptor } from "@app/types/wallets"

import {
  BaseCreatePaymentRequestCreationDataParams,
  Invoice,
  InvoiceType,
  PaymentRequest,
  PaymentRequestState,
  PaymentRequestCreationData,
} from "../payment/index.types"
import { createPaymentRequest } from "../payment/payment-request"
import { createPaymentRequestCreationData } from "../payment/payment-request-creation-data"
import { useWalletResolution } from "./use-wallet-resolution"

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
  const [pr, setPR] = useState<PaymentRequest | null>(null)
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

  useLayoutEffect(() => {
    if (prcd) {
      setPR(
        createPaymentRequest({
          mutations: {
            lnNoAmountInvoiceCreate,
            lnUsdInvoiceCreate,
            lnInvoiceCreate,
            onChainAddressCurrent,
          },
          creationData: prcd,
        }),
      )
    }
  }, [
    prcd,
    lnNoAmountInvoiceCreate,
    lnUsdInvoiceCreate,
    lnInvoiceCreate,
    onChainAddressCurrent,
  ])

  useLayoutEffect(() => {
    if (pr && pr.state === PaymentRequestState.Idle) {
      setPR((current) => current && current.setState(PaymentRequestState.Loading))
      pr.generateRequest().then((newPR) =>
        setPR((currentPR) => {
          // don't override payment request if the request is from different request
          if (currentPR?.creationData === newPR.creationData) return newPR
          return currentPR
        }),
      )
    }
  }, [pr])

  // Triggers regeneration by resetting to Idle
  const regenerateInvoice = useCallback(() => {
    setPR((current) => current && current.setState(PaymentRequestState.Idle))
  }, [])

  useEffect(() => {
    if (wallets?.username && wallets.username !== prcd?.username) {
      setPRCD((current) => current && current.setUsername(wallets.username!))
    }
  }, [wallets?.username, prcd?.username])

  const lastHash = useLnUpdateHashPaid()
  useEffect(() => {
    if (
      pr?.state === PaymentRequestState.Created &&
      pr.info?.data?.invoiceType === Invoice.Lightning &&
      lastHash === pr.info.data.paymentHash
    ) {
      setPR((current) => current && current.setState(PaymentRequestState.Paid))
      ReactNativeHapticFeedback.trigger("notificationSuccess", {
        ignoreAndroidSystemSettings: true,
      })
    }
  }, [lastHash, pr])

  const expiresAt =
    pr?.info?.data?.invoiceType === Invoice.Lightning && pr.info?.data?.expiresAt
      ? pr.info.data.expiresAt
      : null

  const { remainingSeconds: expiresInSeconds, isExpired } = useCountdown(expiresAt)

  useEffect(() => {
    if (isExpired) {
      setPR((current) => current && current.setState(PaymentRequestState.Expired))
    }
  }, [isExpired])

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

  const setReceivingWallet = useCallback(
    (walletCurrency: WalletCurrency) => {
      setPRCD((current) => {
        if (!current?.setReceivingWalletDescriptor) return current

        if (
          current.expirationTime !== undefined &&
          current.receivingWalletDescriptor.currency !== walletCurrency
        ) {
          expirationPerWallet.current[current.receivingWalletDescriptor.currency] =
            current.expirationTime
        }

        const wallet =
          walletCurrency === WalletCurrency.Btc
            ? wallets?.bitcoinWallet
            : wallets?.usdWallet
        if (!wallet) return current

        const updated = current.setReceivingWalletDescriptor({
          id: wallet.id,
          currency: walletCurrency,
        })

        if (updated?.setExpirationTime) {
          return updated.setExpirationTime(expirationPerWallet.current[walletCurrency])
        }
        return updated ?? current
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
    setReceivingWallet,
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
