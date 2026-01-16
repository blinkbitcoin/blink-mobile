import { renderHook, act } from "@testing-library/react-hooks"

import { WalletCurrency } from "@app/graphql/generated"
import { useSyncedInputValues } from "@app/screens/conversion-flow/hooks/use-synced-input-values"
import { ConvertInputType } from "@app/components/transfer-amount-input"
import { DisplayCurrency, toDisplayAmount } from "@app/types/amounts"

type WalletFragment = {
  id: string
  balance: number
  walletCurrency: WalletCurrency
}

const mockBtcWallet: WalletFragment = {
  id: "btc-wallet",
  balance: 100000,
  walletCurrency: WalletCurrency.Btc,
}

const mockUsdWallet: WalletFragment = {
  id: "usd-wallet",
  balance: 50000,
  walletCurrency: WalletCurrency.Usd,
}

const createInitialCurrencyInput = (displayCurrency: string) => ({
  currencyInput: {
    id: ConvertInputType.CURRENCY,
    currency: displayCurrency as DisplayCurrency,
    amount: toDisplayAmount({ amount: 0, currencyCode: displayCurrency }),
    isFocused: false,
    formattedAmount: "",
  },
  formattedAmount: "",
})

describe("useSyncedInputValues", () => {
  it("returns default input values when wallets are undefined", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: undefined,
        toWallet: undefined,
        initialCurrencyInput: createInitialCurrencyInput("USD"),
      }),
    )

    expect(result.current.inputValues.fromInput.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.toInput.currency).toBe(WalletCurrency.Usd)
    expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Usd)
  })

  it("syncs input currencies with wallet currencies (BTC -> USD)", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: mockBtcWallet,
        toWallet: mockUsdWallet,
        initialCurrencyInput: createInitialCurrencyInput("USD"),
      }),
    )

    expect(result.current.inputValues.fromInput.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.toInput.currency).toBe(WalletCurrency.Usd)
    expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.fromInput.amount.currencyCode).toBe("BTC")
    expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Usd)
    expect(result.current.inputValues.toInput.amount.currencyCode).toBe("USD")
  })

  it("syncs input currencies with wallet currencies (USD -> BTC)", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: mockUsdWallet,
        toWallet: mockBtcWallet,
        initialCurrencyInput: createInitialCurrencyInput("USD"),
      }),
    )

    expect(result.current.inputValues.fromInput.currency).toBe(WalletCurrency.Usd)
    expect(result.current.inputValues.toInput.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Usd)
    expect(result.current.inputValues.fromInput.amount.currencyCode).toBe("USD")
    expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.toInput.amount.currencyCode).toBe("BTC")
  })

  it("updates currencies when wallets change from BTC->USD to USD->BTC", () => {
    const { result, rerender } = renderHook(
      ({
        fromWallet,
        toWallet,
      }: {
        fromWallet: WalletFragment
        toWallet: WalletFragment
      }) =>
        useSyncedInputValues({
          fromWallet,
          toWallet,
          initialCurrencyInput: createInitialCurrencyInput("USD"),
        }),
      {
        initialProps: {
          fromWallet: mockBtcWallet,
          toWallet: mockUsdWallet,
        },
      },
    )

    expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Usd)

    rerender({
      fromWallet: mockUsdWallet,
      toWallet: mockBtcWallet,
    })

    expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Usd)
    expect(result.current.inputValues.fromInput.amount.currencyCode).toBe("USD")
    expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Btc)
    expect(result.current.inputValues.toInput.amount.currencyCode).toBe("BTC")
  })

  it("preserves amount values when currencies change", () => {
    const { result, rerender } = renderHook(
      ({
        fromWallet,
        toWallet,
      }: {
        fromWallet: WalletFragment
        toWallet: WalletFragment
      }) =>
        useSyncedInputValues({
          fromWallet,
          toWallet,
          initialCurrencyInput: createInitialCurrencyInput("USD"),
        }),
      {
        initialProps: {
          fromWallet: mockBtcWallet,
          toWallet: mockUsdWallet,
        },
      },
    )

    act(() => {
      result.current.setInputValues((prev) => ({
        ...prev,
        fromInput: {
          ...prev.fromInput,
          amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
        },
        toInput: {
          ...prev.toInput,
          amount: { amount: 500, currency: WalletCurrency.Usd, currencyCode: "USD" },
        },
      }))
    })

    expect(result.current.inputValues.fromInput.amount.amount).toBe(1000)
    expect(result.current.inputValues.toInput.amount.amount).toBe(500)

    rerender({
      fromWallet: mockUsdWallet,
      toWallet: mockBtcWallet,
    })

    expect(result.current.inputValues.fromInput.amount.amount).toBe(1000)
    expect(result.current.inputValues.toInput.amount.amount).toBe(500)
    expect(result.current.inputValues.fromInput.amount.currency).toBe(WalletCurrency.Usd)
    expect(result.current.inputValues.toInput.amount.currency).toBe(WalletCurrency.Btc)
  })

  it("initializes currencyInput with displayCurrency", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: mockBtcWallet,
        toWallet: mockUsdWallet,
        initialCurrencyInput: createInitialCurrencyInput("EUR"),
      }),
    )

    expect(result.current.inputValues.currencyInput.currency).toBe("EUR")
    expect(result.current.inputValues.currencyInput.amount.currencyCode).toBe("EUR")
  })

  it("returns setInputValues function that updates state", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: mockBtcWallet,
        toWallet: mockUsdWallet,
        initialCurrencyInput: createInitialCurrencyInput("USD"),
      }),
    )

    act(() => {
      result.current.setInputValues((prev) => ({
        ...prev,
        formattedAmount: "100",
      }))
    })

    expect(result.current.inputValues.formattedAmount).toBe("100")
  })

  it("sets correct input IDs", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: mockBtcWallet,
        toWallet: mockUsdWallet,
        initialCurrencyInput: createInitialCurrencyInput("USD"),
      }),
    )

    expect(result.current.inputValues.fromInput.id).toBe(ConvertInputType.FROM)
    expect(result.current.inputValues.toInput.id).toBe(ConvertInputType.TO)
    expect(result.current.inputValues.currencyInput.id).toBe(ConvertInputType.CURRENCY)
  })

  it("initializes all inputs as not focused", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: mockBtcWallet,
        toWallet: mockUsdWallet,
        initialCurrencyInput: createInitialCurrencyInput("USD"),
      }),
    )

    expect(result.current.inputValues.fromInput.isFocused).toBe(false)
    expect(result.current.inputValues.toInput.isFocused).toBe(false)
    expect(result.current.inputValues.currencyInput.isFocused).toBe(false)
  })

  it("initializes all formattedAmount as empty strings", () => {
    const { result } = renderHook(() =>
      useSyncedInputValues({
        fromWallet: mockBtcWallet,
        toWallet: mockUsdWallet,
        initialCurrencyInput: createInitialCurrencyInput("USD"),
      }),
    )

    expect(result.current.inputValues.fromInput.formattedAmount).toBe("")
    expect(result.current.inputValues.toInput.formattedAmount).toBe("")
    expect(result.current.inputValues.currencyInput.formattedAmount).toBe("")
    expect(result.current.inputValues.formattedAmount).toBe("")
  })

  it("does not update when wallets are undefined", () => {
    const { result, rerender } = renderHook(
      ({ fromWallet, toWallet }) =>
        useSyncedInputValues({
          fromWallet,
          toWallet,
          initialCurrencyInput: createInitialCurrencyInput("USD"),
        }),
      {
        initialProps: {
          fromWallet: undefined as typeof mockBtcWallet | undefined,
          toWallet: undefined as typeof mockUsdWallet | undefined,
        },
      },
    )

    const initialFromCurrency = result.current.inputValues.fromInput.amount.currency
    const initialToCurrency = result.current.inputValues.toInput.amount.currency

    rerender({
      fromWallet: undefined,
      toWallet: undefined,
    })

    expect(result.current.inputValues.fromInput.amount.currency).toBe(initialFromCurrency)
    expect(result.current.inputValues.toInput.amount.currency).toBe(initialToCurrency)
  })
})
