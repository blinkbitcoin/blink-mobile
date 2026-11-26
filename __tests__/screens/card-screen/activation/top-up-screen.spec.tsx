import React from "react"
import { act, fireEvent, render } from "@testing-library/react-native"

import { CardActivationStep, WalletCurrency } from "@app/graphql/generated"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { CardTopUpScreen } from "@app/screens/card-screen/activation/top-up-screen"
import { CARD } from "@app/types/amounts"

import { ContextForScreen } from "../../helper"

const mockComplete = jest.fn()
const mockUseCardActivation = jest.fn()
jest.mock("@app/hooks/use-card-activation", () => ({
  useCardActivation: (options: Record<string, unknown>) => mockUseCardActivation(options),
}))

type Balances = { btc: number; usd: number }

const mockUseActiveWallet = jest.fn()
jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

const walletsWith = ({ btc, usd }: Balances) => ({
  wallets: [
    {
      id: "btc-wallet",
      walletCurrency: WalletCurrency.Btc,
      balance: { amount: btc, currency: WalletCurrency.Btc, currencyCode: "BTC" },
    },
    {
      id: "usd-wallet",
      walletCurrency: WalletCurrency.Usd,
      balance: { amount: usd, currency: WalletCurrency.Usd, currencyCode: "USD" },
    },
  ],
})

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardTopUpScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

const balanceWay = "From your Bitcoin or Dollar Balance"
const depositWay = "Deposit to your Card Balance"

describe("CardTopUpScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseCardActivation.mockReturnValue({ complete: mockComplete, isCompleting: false })
    mockUseActiveWallet.mockReturnValue(walletsWith({ btc: 21420, usd: 0 }))
  })

  it("stands for the top-up step of the activation", async () => {
    await renderScreen()

    expect(mockUseCardActivation).toHaveBeenCalledWith({
      step: CardActivationStep.TopUp,
    })
  })

  it("offers adding funds now or later", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Top-up your card")).toBeTruthy()
    expect(getByText("Add funds now, or later.")).toBeTruthy()
  })

  it("preselects the balances when the Bitcoin Balance holds funds", async () => {
    const { getByRole } = await renderScreen()

    expect(getByRole("radio", { name: balanceWay })).toBeSelected()
  })

  it("preselects the balances when only the Dollar Balance holds funds", async () => {
    mockUseActiveWallet.mockReturnValue(walletsWith({ btc: 0, usd: 500 }))
    const { getByRole } = await renderScreen()

    expect(getByRole("radio", { name: balanceWay })).toBeSelected()
  })

  it("greys the balances out when neither holds funds", async () => {
    mockUseActiveWallet.mockReturnValue(walletsWith({ btc: 0, usd: 0 }))
    const { getByRole } = await renderScreen()

    const balance = getByRole("radio", { name: balanceWay })
    expect(balance).toBeDisabled()
    expect(balance).not.toBeSelected()
  })

  it("offers the deposit, left unchosen while the balances hold funds", async () => {
    const { getByRole } = await renderScreen()

    const deposit = getByRole("radio", { name: depositWay })
    expect(deposit).toBeEnabled()
    expect(deposit).not.toBeSelected()
  })

  it("preselects the deposit when neither balance holds funds", async () => {
    mockUseActiveWallet.mockReturnValue(walletsWith({ btc: 0, usd: 0 }))
    const { getByRole, getByText } = await renderScreen()

    expect(getByRole("radio", { name: depositWay })).toBeSelected()
    expect(getByText("Top-up now")).toBeEnabled()
  })

  it("completes the activation and opens the Transfer into the Card Balance", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Top-up now"))
    })

    expect(mockComplete).toHaveBeenCalledWith({
      then: { name: "conversionDetails", params: { destination: CARD } },
    })
  })

  it("keeps the way the member taps", async () => {
    const { getByRole, getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByRole("radio", { name: balanceWay }))
    })
    await act(async () => {
      fireEvent.press(getByText("Top-up now"))
    })

    expect(getByRole("radio", { name: balanceWay })).toBeSelected()
    expect(mockComplete).toHaveBeenCalledWith({
      then: { name: "conversionDetails", params: { destination: CARD } },
    })
  })

  it("leaves a way not offered unchosen when tapped", async () => {
    mockUseActiveWallet.mockReturnValue(walletsWith({ btc: 0, usd: 0 }))
    const { getByRole } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByRole("radio", { name: balanceWay }))
    })

    expect(getByRole("radio", { name: depositWay })).toBeSelected()
  })

  it("completes the activation and opens Receive into the Card Balance", async () => {
    const { getByRole, getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByRole("radio", { name: depositWay }))
    })
    await act(async () => {
      fireEvent.press(getByText("Top-up now"))
    })

    expect(mockComplete).toHaveBeenCalledWith({
      then: { name: "receiveBitcoin", params: { destination: CARD } },
    })
  })

  it("completes the activation when the member skips the top-up", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Skip top-up"))
    })

    expect(mockComplete).toHaveBeenCalledWith()
  })

  it("shows a skip running on the skip, with Top-up now off", async () => {
    mockUseCardActivation.mockReturnValue({ complete: mockComplete, isCompleting: true })
    const { getByText, queryByText } = await renderScreen()

    expect(queryByText("Skip top-up")).toBeNull()
    expect(getByText("Top-up now")).toBeDisabled()
  })

  it("shows a top-up running on Top-up now, with the skip off", async () => {
    const { getByText, queryByText, rerender } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Top-up now"))
    })
    mockUseCardActivation.mockReturnValue({ complete: mockComplete, isCompleting: true })
    rerender(
      <ContextForScreen>
        <CardTopUpScreen />
      </ContextForScreen>,
    )

    expect(queryByText("Top-up now")).toBeNull()
    expect(getByText("Skip top-up")).toBeDisabled()
  })
})
