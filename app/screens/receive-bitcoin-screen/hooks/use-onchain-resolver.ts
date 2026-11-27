import { WalletCurrency } from "@app/graphql/generated"
import {
  NewOnchainAddressResult,
  type ReceivePaymentRequestState,
} from "../payment/request-state.types"

import { useOnChainAddress } from "./use-onchain-address"

type RequestState = ReceivePaymentRequestState

/** `isOnchainFromRequest`: the request brings its own address (a self-custodial
 *  wallet, or the Card Balance's) instead of the custodial wallet's. */
export const useOnchainResolver = (
  isOnchainFromRequest: boolean,
  requestState: RequestState,
  onchainWalletCurrency: WalletCurrency,
) => {
  const onchainWalletIds: Record<WalletCurrency, string | undefined> = {
    [WalletCurrency.Btc]: requestState.btcWalletId,
    [WalletCurrency.Usd]: requestState.usdWalletId,
  }

  const custodialWalletId = isOnchainFromRequest
    ? undefined
    : onchainWalletIds[onchainWalletCurrency]
  const custodialOnchain = useOnChainAddress(custodialWalletId, {
    amount: requestState.settlementAmount?.amount,
    memo: requestState.memo || undefined,
  })

  // `failed` is a request that settled without an address: nothing more is coming,
  // so the screen offers New as the way to retry instead of waiting on a spinner.
  if (isOnchainFromRequest) {
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
    failed: custodialOnchain.failed,
    getFullUriFn: custodialOnchain.getFullUriFn,
    generateNewAddress: custodialOnchain.generateNewAddress,
  }
}
