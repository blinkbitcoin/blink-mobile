import { useMemo } from "react"

import { gql } from "@apollo/client"
import {
  createCustodialClaimDeposit,
  createCustodialConvert,
  createCustodialListPendingDeposits,
  createCustodialReceiveLightning,
  createCustodialReceiveOnchain,
} from "@app/custodial/adapters/payment"
import {
  useIntraLedgerPaymentSendMutation,
  useIntraLedgerUsdPaymentSendMutation,
  useLnInvoiceCreateMutation,
  useLnNoAmountInvoiceCreateMutation,
  useLnUsdInvoiceCreateMutation,
  useOnChainAddressCurrentMutation,
  WalletCurrency,
} from "@app/graphql/generated"
import {
  createClaimDeposit,
  createListPendingDeposits,
} from "@app/self-custodial/adapters/deposit"
import {
  createGetFee,
  createSelfCustodialConvert,
  createSelfCustodialReceiveLightning,
  createSelfCustodialReceiveOnchain,
  createSendPayment,
} from "@app/self-custodial/adapters/payment"
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

  mutation onChainAddressCurrent($input: OnChainAddressCurrentInput!) {
    onChainAddressCurrent(input: $input) {
      errors {
        message
      }
      address
    }
  }
`

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

type CustodialWalletIds = { btcWalletId: WalletId; usdWalletId: WalletId }

type CustodialMutations = {
  intraLedgerPaymentSend: Parameters<
    typeof createCustodialConvert
  >[0]["intraLedgerPaymentSend"]
  intraLedgerUsdPaymentSend: Parameters<
    typeof createCustodialConvert
  >[0]["intraLedgerUsdPaymentSend"]
  lnInvoiceCreate: ReturnType<typeof useLnInvoiceCreateMutation>[0]
  lnNoAmountInvoiceCreate: ReturnType<typeof useLnNoAmountInvoiceCreateMutation>[0]
  lnUsdInvoiceCreate: ReturnType<typeof useLnUsdInvoiceCreateMutation>[0]
  onChainAddressCurrent: ReturnType<typeof useOnChainAddressCurrentMutation>[0]
}

const extractCustodialWalletIds = (
  wallets: ReturnType<typeof useActiveWallet>["wallets"],
): CustodialWalletIds | null => {
  const btc = wallets.find((w) => w.walletCurrency === WalletCurrency.Btc)
  const usd = wallets.find((w) => w.walletCurrency === WalletCurrency.Usd)
  if (!btc || !usd) return null
  return { btcWalletId: btc.id, usdWalletId: usd.id }
}

const buildSelfCustodialPayments = (
  sdk: NonNullable<ReturnType<typeof useSelfCustodialWallet>["sdk"]>,
): PaymentsResult => ({
  sendPayment: createSendPayment(sdk),
  getFee: createGetFee(sdk),
  receiveLightning: createSelfCustodialReceiveLightning(sdk),
  receiveOnchain: createSelfCustodialReceiveOnchain(sdk),
  listPendingDeposits: createListPendingDeposits(sdk),
  claimDeposit: createClaimDeposit(sdk),
  convert: createSelfCustodialConvert(sdk),
  accountType: AccountType.SelfCustodial,
})

const buildCustodialPayments = (
  walletIds: CustodialWalletIds,
  mutations: CustodialMutations,
): PaymentsResult => {
  const receiveDeps = {
    lnInvoiceCreate: mutations.lnInvoiceCreate,
    lnNoAmountInvoiceCreate: mutations.lnNoAmountInvoiceCreate,
    lnUsdInvoiceCreate: mutations.lnUsdInvoiceCreate,
    onChainAddressCurrent: mutations.onChainAddressCurrent,
    btcWalletId: walletIds.btcWalletId,
    usdWalletId: walletIds.usdWalletId,
  }
  return {
    listPendingDeposits: createCustodialListPendingDeposits,
    claimDeposit: createCustodialClaimDeposit,
    convert: createCustodialConvert({
      intraLedgerPaymentSend: mutations.intraLedgerPaymentSend,
      intraLedgerUsdPaymentSend: mutations.intraLedgerUsdPaymentSend,
      btcWalletId: walletIds.btcWalletId,
      usdWalletId: walletIds.usdWalletId,
    }),
    receiveLightning: createCustodialReceiveLightning(receiveDeps),
    receiveOnchain: createCustodialReceiveOnchain(receiveDeps),
    accountType: AccountType.Custodial,
  }
}

export const usePayments = (): PaymentsResult => {
  const { activeAccount } = useAccountRegistry()
  const { sdk } = useSelfCustodialWallet()
  const accountType = activeAccount?.type

  /** Apollo mutation hooks must run on every render to satisfy the rules of hooks; their results only feed the custodial branch when that path is active. */
  const [intraLedgerPaymentSend] = useIntraLedgerPaymentSendMutation()
  const [intraLedgerUsdPaymentSend] = useIntraLedgerUsdPaymentSendMutation()
  const [lnInvoiceCreate] = useLnInvoiceCreateMutation()
  const [lnNoAmountInvoiceCreate] = useLnNoAmountInvoiceCreateMutation()
  const [lnUsdInvoiceCreate] = useLnUsdInvoiceCreateMutation()
  const [onChainAddressCurrent] = useOnChainAddressCurrentMutation()

  const { wallets } = useActiveWallet()
  const custodialIds = useMemo(
    () =>
      accountType === AccountType.Custodial ? extractCustodialWalletIds(wallets) : null,
    [accountType, wallets],
  )

  return useMemo((): PaymentsResult => {
    if (accountType === AccountType.SelfCustodial && sdk) {
      return buildSelfCustodialPayments(sdk)
    }
    if (accountType === AccountType.Custodial && custodialIds) {
      return buildCustodialPayments(custodialIds, {
        intraLedgerPaymentSend,
        intraLedgerUsdPaymentSend,
        lnInvoiceCreate,
        lnNoAmountInvoiceCreate,
        lnUsdInvoiceCreate,
        onChainAddressCurrent,
      })
    }
    return { accountType }
  }, [
    accountType,
    sdk,
    intraLedgerPaymentSend,
    intraLedgerUsdPaymentSend,
    lnInvoiceCreate,
    lnNoAmountInvoiceCreate,
    lnUsdInvoiceCreate,
    onChainAddressCurrent,
    custodialIds,
  ])
}
