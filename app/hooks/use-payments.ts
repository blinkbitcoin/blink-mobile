import { useMemo } from "react"

import {
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialListPendingDeposits,
} from "@app/custodial/adapters/payment-adapter"
import {
  createGetFee,
  createSendPayment,
} from "@app/self-custodial/adapters/payment-adapter"
import {
  createClaimDeposit,
  createListPendingDeposits,
} from "@app/self-custodial/adapters/deposit-adapter"
import {
  createConvert,
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
  accountType?: AccountType
}

export const usePayments = (): PaymentsResult => {
  const { activeAccount } = useAccountRegistry()
  const { sdk } = useSelfCustodialWallet()
  const accountType = activeAccount?.type

  return useMemo((): PaymentsResult => {
    if (accountType === AccountType.SelfCustodial && sdk) {
      return {
        sendPayment: createSendPayment(sdk),
        getFee: createGetFee(sdk),
        receiveLightning: createReceiveLightning(sdk),
        receiveOnchain: createReceiveOnchain(sdk),
        listPendingDeposits: createListPendingDeposits(sdk),
        claimDeposit: createClaimDeposit(sdk),
        convert: createConvert(sdk),
        accountType,
      }
    }

    if (accountType === AccountType.Custodial) {
      return {
        listPendingDeposits: createCustodialListPendingDeposits,
        claimDeposit: createCustodialClaimDeposit,
        convert: createCustodialConvert,
        accountType,
      }
    }

    return { accountType }
  }, [accountType, sdk])
}
