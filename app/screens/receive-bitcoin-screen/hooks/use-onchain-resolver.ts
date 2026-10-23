import { WalletCurrency } from "@app/graphql/generated"
import {
  NewOnchainAddressResult,
  type ReceivePaymentRequestState,
} from "../payment/request-state.types"

import { useOnChainAddress } from "./use-onchain-address"

type RequestState = ReceivePaymentRequestState

export const useOnchainResolver = (
  isSelfCustodial: boolean,
  requestState: RequestState,
  onchainWalletCurrency: WalletCurrency,
) => {
  const onchainWalletIds: Record<WalletCurrency, string | undefined> = {
    [WalletCurrency.Btc]: requestState.btcWalletId,
    [WalletCurrency.Usd]: requestState.usdWalletId,
  }

  const custodialWalletId = isSelfCustodial
    ? undefined
    : onchainWalletIds[onchainWalletCurrency]
  const custodialOnchain = useOnChainAddress(custodialWalletId, {
    amount: requestState.settlementAmount?.amount,
    memo: requestState.memo || undefined,
  })

  // `failed` is a request that settled without an address: nothing more is coming,
  // so the screen offers New as the way to retry instead of waiting on a spinner.
  if (isSelfCustodial) {
    const failed =
      !requestState.onchainAddress && Boolean(requestState.onchainAddressFailed)
    return {
      address: requestState.onchainAddress ?? null,
      loading: !requestState.onchainAddress && !failed,
      failed,
      getFullUriFn: requestState.getOnchainFullUriFn,
      generateNewAddress:
        requestState.generateNewOnchainAddress ??
        (() => Promise.resolve(NewOnchainAddressResult.Failed)),
    }
  }

  return {
    address: custodialOnchain.address,
    loading: custodialOnchain.loading,
    failed:
      Boolean(custodialWalletId) &&
      !custodialOnchain.loading &&
      !custodialOnchain.address,
    getFullUriFn: custodialOnchain.getFullUriFn,
    generateNewAddress: custodialOnchain.generateNewAddress,
  }
}
