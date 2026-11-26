import { ConvertInputType } from "@app/components/transfer-amount-input"
import {
  CardCurrency,
  MoneyAmount,
  toWalletAmount,
  WalletOrDisplayCurrency,
} from "@app/types/amounts"

import { TransferWallet } from "./hooks/use-transfer-wallets"
import { TransferBalance, transferPillHandlers } from "./transfer-balances"
import { InputField, InputValues } from "./use-convert-money-details"

type TransferSides = { fromWallet: TransferWallet; toWallet: TransferWallet }

type Params = TransferSides & {
  sides: Record<TransferBalance, TransferWallet | undefined>
  balances: readonly TransferBalance[]
  destination: CardCurrency | undefined
  uiLocked: boolean
  focusedInputValues: InputField | null
  inputValues: InputValues
  setWallets: (sides: TransferSides) => void
  setFocusedInputValues: (input: InputField) => void
  setLockFormattingInputId: (id: InputField["id"] | null) => void
  setIsTyping: (isTyping: boolean) => void
  setSelectedPercent: (percent: number | null) => void
  setInitialAmount: (amount: MoneyAmount<WalletOrDisplayCurrency>) => void
}

/**
 * The pills that switch a side of the Transfer to another balance. Another balance on
 * either side starts the amount over, since the one typed was in the other balance's
 * currency; a display-currency amount being typed keeps its focus.
 */
export const transferSideSwitch = ({
  fromWallet,
  toWallet,
  sides,
  balances,
  destination,
  uiLocked,
  focusedInputValues,
  inputValues,
  setWallets,
  setFocusedInputValues,
  setLockFormattingInputId,
  setIsTyping,
  setSelectedPercent,
  setInitialAmount,
}: Params) => {
  const restartWith = (next: TransferSides) => {
    const currency = next.fromWallet.walletCurrency
    const zeroFromAmount = toWalletAmount({ amount: 0, currency })
    const isCurrencyFocused = focusedInputValues?.id === ConvertInputType.CURRENCY
    setSelectedPercent(null)
    setLockFormattingInputId(null)
    setIsTyping(false)
    setWallets(next)
    if (!isCurrencyFocused) {
      setFocusedInputValues({
        ...inputValues.fromInput,
        id: ConvertInputType.FROM,
        isFocused: true,
        currency,
        amount: zeroFromAmount,
      })
    }
    setInitialAmount(zeroFromAmount)
  }

  return transferPillHandlers({
    balances,
    destination,
    pair: { from: fromWallet.kind, to: toWallet.kind },
    sides,
    isLocked: uiLocked,
    onChange: restartWith,
  })
}
