import { useMemo } from "react"

import {
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialListPendingDeposits,
} from "@app/custodial/adapters/payment-adapter"
import {
  createReceiveLightning,
  createReceiveOnchain,
} from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet-provider"
import {
  type ClaimDepositAdapter,
  type ConvertAdapter,
  type GetFeeAdapter,
  type ListPendingDepositsAdapter,
  type ReceiveLightningAdapter,
  type ReceiveOnchainAdapter,
  type SendPaymentAdapter,
} from "@app/types/payment.types"
import { AccountType } from "@app/types/wallet.types"

import { useAccountRegistry } from "./use-account-registry"

type PaymentsResult = {
  sendPayment?: SendPaymentAdapter
  getFee?: GetFeeAdapter
  receiveLightning?: ReceiveLightningAdapter
  receiveOnchain?: ReceiveOnchainAdapter
  listPendingDeposits?: ListPendingDepositsAdapter
  claimDeposit?: ClaimDepositAdapter
  convert?: ConvertAdapter
  accountType: AccountType
}

export const usePayments = (): PaymentsResult => {
  const { activeAccount } = useAccountRegistry()
  const { sdk } = useSelfCustodialWallet()
  const accountType = activeAccount?.type ?? AccountType.Custodial

  return useMemo((): PaymentsResult => {
    if (accountType === AccountType.SelfCustodial && sdk) {
      return {
        receiveLightning: createReceiveLightning(sdk),
        receiveOnchain: createReceiveOnchain(sdk),
        accountType,
      }
    }

    return {
      listPendingDeposits: createCustodialListPendingDeposits,
      claimDeposit: createCustodialClaimDeposit,
      convert: createCustodialConvert,
      accountType,
    }
  }, [accountType, sdk])
}
