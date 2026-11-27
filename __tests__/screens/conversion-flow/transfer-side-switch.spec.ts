import { WalletCurrency } from "@app/graphql/generated"
import { ConvertInputType } from "@app/components/transfer-amount-input"
import { transferSideSwitch } from "@app/screens/conversion-flow/transfer-side-switch"
import { CARD, DisplayCurrency } from "@app/types/amounts"

const btcSide = {
  id: "btc-wallet",
  balance: 22,
  walletCurrency: WalletCurrency.Btc,
  kind: WalletCurrency.Btc,
}
const usdSide = {
  id: "usd-wallet",
  balance: 5233,
  walletCurrency: WalletCurrency.Usd,
  kind: WalletCurrency.Usd,
}
const cardSide = {
  id: "card-1",
  balance: 125000,
  walletCurrency: WalletCurrency.Btc,
  kind: CARD,
}

const inputOf = (
  id: ConvertInputType,
  currency: WalletCurrency | typeof DisplayCurrency,
) => ({
  id,
  currency,
  amount: { amount: 0, currency, currencyCode: currency },
  isFocused: false,
  formattedAmount: "",
})

const inputValues = {
  fromInput: inputOf(ConvertInputType.FROM, WalletCurrency.Btc),
  toInput: inputOf(ConvertInputType.TO, WalletCurrency.Usd),
  currencyInput: inputOf(ConvertInputType.CURRENCY, DisplayCurrency),
  formattedAmount: "",
}

const setters = {
  setWallets: jest.fn(),
  setFocusedInputValues: jest.fn(),
  setLockFormattingInputId: jest.fn(),
  setIsTyping: jest.fn(),
  setSelectedPercent: jest.fn(),
  setInitialAmount: jest.fn(),
}

const switchFor = (focusedId: ConvertInputType | null = ConvertInputType.FROM) =>
  transferSideSwitch({
    fromWallet: btcSide,
    toWallet: cardSide,
    sides: {
      [WalletCurrency.Btc]: btcSide,
      [WalletCurrency.Usd]: usdSide,
      [CARD]: cardSide,
    },
    balances: [WalletCurrency.Btc, WalletCurrency.Usd, CARD],
    destination: CARD,
    uiLocked: false,
    focusedInputValues: focusedId ? { ...inputValues.fromInput, id: focusedId } : null,
    inputValues,
    ...setters,
  })

describe("transferSideSwitch", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("switches the side and starts the amount over in the new source's currency", () => {
    switchFor().onSourcePillPress?.()

    const zeroDollars = { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" }
    expect(setters.setWallets).toHaveBeenCalledWith({
      fromWallet: usdSide,
      toWallet: cardSide,
    })
    expect(setters.setSelectedPercent).toHaveBeenCalledWith(null)
    expect(setters.setLockFormattingInputId).toHaveBeenCalledWith(null)
    expect(setters.setIsTyping).toHaveBeenCalledWith(false)
    expect(setters.setInitialAmount).toHaveBeenCalledWith(zeroDollars)
    expect(setters.setFocusedInputValues).toHaveBeenCalledWith({
      ...inputValues.fromInput,
      id: ConvertInputType.FROM,
      isFocused: true,
      currency: WalletCurrency.Usd,
      amount: zeroDollars,
    })
  })

  it("puts the focus on the source when nothing was focused", () => {
    switchFor(null).onSourcePillPress?.()

    expect(setters.setFocusedInputValues).toHaveBeenCalled()
  })

  it("keeps the focus on a display-currency amount being typed", () => {
    switchFor(ConvertInputType.CURRENCY).onSourcePillPress?.()

    expect(setters.setFocusedInputValues).not.toHaveBeenCalled()
    expect(setters.setInitialAmount).toHaveBeenCalled()
  })

  it("tells whether the flip is offered", () => {
    expect(switchFor().isFlipOffered).toBe(false)
  })
})
