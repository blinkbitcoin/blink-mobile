import { useMemo } from "react"

import {
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialListPendingDeposits,
} from "@app/custodial/adapters/payment"
import {
  useIntraLedgerPaymentSendMutation,
  useIntraLedgerUsdPaymentSendMutation,
  WalletCurrency,
} from "@app/graphql/generated"
import {
  createClaimDeposit,
  createListPendingDeposits,
} from "@app/self-custodial/adapters/deposit"
import {
  createGetFee,
  createSelfCustodialConvert,
  createSendPayment,
} from "@app/self-custodial/adapters/payment"
import { createReceiveLightning, createReceiveOnchain } from "@app/self-custodial/bridge"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  type ClaimDepositAdapter,
  type ConvertAdapter,
  type GetFeeAdapter,
  type ListPendingDepositsAdapter,
  type ReceiveLightningAdapter,
  type ReceiveOnchainAdapter,
  type SendPaymentAdapter,
} from "@app/types/payment"
import { AccountType, WalletId } from "@app/types/wallet"

import { useAccountRegistry } from "./use-account-registry"
import { useActiveWallet } from "./use-active-wallet"

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

const extractCustodialWalletIds = (
  wallets: ReturnType<typeof useActiveWallet>["wallets"],
): { btcWalletId: WalletId; usdWalletId: WalletId } | null => {
  const btc = wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
  const usd = wallets.find((w) => w.walletCurrency === WalletCurrency.Usd)
  if (!btc || !usd) return null
  return { btcWalletId: btc.id, usdWalletId: usd.id }
}

export const usePayments = (): PaymentsResult => {
  const { activeAccount } = useAccountRegistry()
  const { sdk } = useSelfCustodialWallet()
  const accountType = activeAccount?.type

  /** Apollo mutation hooks must run on every render to satisfy the rules of hooks; their results only feed the custodial adapter when that path is active. */
  const [intraLedgerPaymentSend] = useIntraLedgerPaymentSendMutation()
  const [intraLedgerUsdPaymentSend] = useIntraLedgerUsdPaymentSendMutation()

  const { wallets } = useActiveWallet()
  const custodialIds = useMemo(
    () =>
      accountType === AccountType.Custodial ? extractCustodialWalletIds(wallets) : null,
    [accountType, wallets],
  )

  return useMemo((): PaymentsResult => {
    if (accountType === AccountType.SelfCustodial && sdk) {
      return {
        sendPayment: createSendPayment(sdk),
        getFee: createGetFee(sdk),
        receiveLightning: createReceiveLightning(sdk),
        receiveOnchain: createReceiveOnchain(sdk),
        listPendingDeposits: createListPendingDeposits(sdk),
        claimDeposit: createClaimDeposit(sdk),
        convert: createSelfCustodialConvert(sdk),
        accountType,
      }
    }

    if (accountType === AccountType.Custodial) {
      return {
        listPendingDeposits: createCustodialListPendingDeposits,
        claimDeposit: createCustodialClaimDeposit,
        convert: custodialIds
          ? createCustodialConvert({
              intraLedgerPaymentSend,
              intraLedgerUsdPaymentSend,
              btcWalletId: custodialIds.btcWalletId,
              usdWalletId: custodialIds.usdWalletId,
            })
          : undefined,
        accountType,
      }
    }

    return { accountType }
  }, [accountType, sdk, intraLedgerPaymentSend, intraLedgerUsdPaymentSend, custodialIds])
}
