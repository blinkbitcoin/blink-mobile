import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  CardCollateralDepositIntentStatus,
  CardCollateralDepositMethod,
  WalletCurrency,
} from "@app/graphql/generated"
import { useDisplayCurrency } from "@app/hooks/use-display-currency"
import { usePriceConversion } from "@app/hooks/use-price-conversion"
import { useI18nContext } from "@app/i18n/i18n-react"
import { TranslationFunctions } from "@app/i18n/i18n-types"
import {
  CARD,
  MoneyAmount,
  WalletOrDisplayCurrency,
  toBtcMoneyAmount,
} from "@app/types/amounts"
import { toastShow } from "@app/utils/toast"

import { getPaymentRequestFullUri } from "../payment/helpers"
import { Invoice, PaymentRequestState } from "../payment/index.types"
import type {
  ReceiveInvoiceInfo,
  ReceivePaymentRequestState,
} from "../payment/request-state.types"
import { useCardDeposit } from "./use-card-deposit"

const TOO_MANY_PENDING_DEPOSIT_INTENTS = "TOO_MANY_PENDING_DEPOSIT_INTENTS"

const noop = (): void => undefined

type UriParams = { uppercase?: boolean; prefix?: boolean }

/** Why a deposit failed, when blink-card says more than that it failed. */
const depositErrorMessage = (
  deposit: ReturnType<typeof useCardDeposit>,
  LL: TranslationFunctions,
  otherwise: string | undefined,
): string | undefined => {
  if (deposit.status === CardCollateralDepositIntentStatus.Failed) {
    return LL.CardFlow.Deposit.failed()
  }
  if (deposit.error?.code === TOO_MANY_PENDING_DEPOSIT_INTENTS) {
    return LL.CardFlow.CardBalanceTransfer.tooManyPending()
  }
  return otherwise
}

/**
 * Receive into the Card Balance. blink-card mints the Lightning invoice and
 * the on-chain address for the card, never the member's wallets or their
 * Lightning address, since a payment to those lands in a wallet. It mints them
 * only for an amount, and the address only once its page is opened, because
 * each one holds one of the few deposits an account may have waiting.
 */
export const useCardDepositRequest = (): ReceivePaymentRequestState | null => {
  const { LL } = useI18nContext()
  const { convertMoneyAmount } = usePriceConversion()
  const { formatMoneyAmount } = useDisplayCurrency()
  const [unitOfAccountAmount, setUnitOfAccountAmount] =
    useState<MoneyAmount<WalletOrDisplayCurrency>>()
  const [isOnchainRequested, setIsOnchainRequested] = useState(false)

  const settlementAmount =
    unitOfAccountAmount && convertMoneyAmount
      ? convertMoneyAmount(unitOfAccountAmount, WalletCurrency.Btc)
      : undefined
  const amountSats = settlementAmount?.amount ?? 0

  const lightning = useCardDeposit({
    method: CardCollateralDepositMethod.Lightning,
    amountSats,
    isRequested: true,
  })
  const onchain = useCardDeposit({
    method: CardCollateralDepositMethod.Onchain,
    amountSats,
    isRequested: isOnchainRequested,
  })

  const paidDeposit = [lightning, onchain].find(
    (deposit) => deposit.state === PaymentRequestState.Paid,
  )
  const isPaid = paidDeposit !== undefined
  const creditedSats = paidDeposit?.creditedSats ?? amountSats

  const hasAnnouncedCreditRef = useRef(false)
  useEffect(() => {
    if (!isPaid || hasAnnouncedCreditRef.current) return
    hasAnnouncedCreditRef.current = true
    const amount = formatMoneyAmount({ moneyAmount: toBtcMoneyAmount(creditedSats) })
    toastShow({ type: "success", message: LL.CardFlow.Deposit.credited({ amount }), LL })
  }, [isPaid, creditedSats, formatMoneyAmount, LL])

  const invoice = lightning.destination
  const info = useMemo<{ data: ReceiveInvoiceInfo } | undefined>(() => {
    if (!invoice) return undefined
    return {
      data: {
        invoiceType: Invoice.Lightning,
        paymentRequest: invoice,
        getFullUriFn: ({ uppercase, prefix }: UriParams) =>
          getPaymentRequestFullUri({
            input: invoice,
            uppercase,
            prefix,
            type: Invoice.Lightning,
          }),
        getCopyableInvoiceFn: () => invoice,
      },
    }
  }, [invoice])

  const address = onchain.destination
  const getOnchainFullUriFn = useMemo(() => {
    if (!address) return undefined
    return ({ uppercase, prefix }: UriParams) =>
      getPaymentRequestFullUri({
        input: address,
        amount: amountSats,
        uppercase,
        prefix,
        type: Invoice.OnChain,
      })
  }, [address, amountSats])

  const requestOnchainAddress = useCallback(() => setIsOnchainRequested(true), [])

  if (!convertMoneyAmount) return null

  const state = isPaid ? PaymentRequestState.Paid : lightning.state
  const hasAmount = amountSats > 0
  const amountPrompt = hasAmount ? undefined : LL.CardFlow.Deposit.setAmount()
  const isOnchainFailed = onchain.state === PaymentRequestState.Error

  return {
    type: Invoice.Lightning,
    state,
    setType: noop,
    setMemo: noop,
    setAmount: setUnitOfAccountAmount,
    switchReceivingWallet: noop,
    setExpirationTime: noop,
    regenerateInvoice: lightning.regenerate,
    expiresInSeconds: lightning.expiresInSeconds,
    canSetExpirationTime: false,
    memoChangeText: LL.CardFlow.Deposit.note(),
    setMemoChangeText: noop,
    convertMoneyAmount,
    settlementAmount,
    unitOfAccountAmount,
    receivingWalletDescriptor: { id: CARD, currency: WalletCurrency.Btc },
    canSetAmount: true,
    canSetMemo: false,
    canUsePaycode: false,
    lnAddressHostname: "",
    feesInformation: undefined,
    info,
    onchainAddress: address,
    onchainAddressFailed: isOnchainFailed,
    getOnchainFullUriFn,
    pr: { state, info },
    destination: CARD,
    amountPrompt,
    convertingMessage: LL.CardFlow.Deposit.crediting(),
    errorMessage: depositErrorMessage(lightning, LL, undefined),
    onchainErrorMessage: depositErrorMessage(
      onchain,
      LL,
      LL.CardFlow.Deposit.addressFailed(),
    ),
    requestOnchainAddress,
  }
}
