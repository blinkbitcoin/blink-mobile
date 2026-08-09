import { WalletCurrency } from "@app/graphql/generated"
import type { ReceivePaymentRequestState } from "../payment/request-state.types"

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

  const custodialOnchain = useOnChainAddress(
    isSelfCustodial ? undefined : onchainWalletIds[onchainWalletCurrency],
    {
      amount: requestState.settlementAmount?.amount,
      memo: requestState.memo || undefined,
    },
  )

  if (isSelfCustodial) {
    return {
      address: requestState.onchainAddress ?? null,
      loading: !requestState.onchainAddress,
      getFullUriFn: requestState.getOnchainFullUriFn,
      rotate: requestState.rotateOnchainAddress,
    }
  }

  return {
    address: custodialOnchain.address,
    loading: custodialOnchain.loading,
    getFullUriFn: custodialOnchain.getFullUriFn,
    // Custodial addresses come from the server's `onChainAddressCurrent`; rotation
    // is not the client's to drive.
    rotate: undefined,
  }
}
