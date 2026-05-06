import { useMemo } from "react"

import {
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialListPendingDeposits,
} from "@app/custodial/adapters/payment-adapter"
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
  const accountType = activeAccount?.type ?? AccountType.Custodial

  return useMemo(
    (): PaymentsResult => ({
      listPendingDeposits: createCustodialListPendingDeposits,
      claimDeposit: createCustodialClaimDeposit,
      convert: createCustodialConvert,
      accountType,
    }),
    [accountType],
  )
}
