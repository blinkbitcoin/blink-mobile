import { WalletCurrency } from "@app/graphql/generated"
import type { SelfCustodialPaymentRequestState } from "@app/self-custodial/hooks/types"

import { useOnChainAddress } from "./use-onchain-address"

type RequestState = SelfCustodialPaymentRequestState

export const useOnchainResolver = (
  requestState: RequestState,
  onchainWalletCurrency: WalletCurrency,
) => {
  const onchain = useOnChainAddress({
    walletCurrency: onchainWalletCurrency,
    amount: requestState.settlementAmount?.amount,
    memo: requestState.memo || undefined,
  })

  return {
    address: onchain.address,
    loading: onchain.loading,
    getFullUriFn: onchain.getFullUriFn,
  }
}
