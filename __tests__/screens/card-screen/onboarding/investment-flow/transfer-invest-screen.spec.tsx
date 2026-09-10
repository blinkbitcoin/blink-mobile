import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TransferInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/transfer-invest-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockNavigate = jest.fn()

/** Deliberately not the $10,000 the copy used to hardcode: an amount the screen ignores
 *  would still read correctly against that one. */
const SELECTED_AMOUNT_USD = 25000

const mockRouteParams: {
  current: { selectedAmountUsd: number; settlementSats?: number }
} = { current: { selectedAmountUsd: SELECTED_AMOUNT_USD } }

/** The wallet the investment is paid into, which ops sets remotely; empty until that
 *  account is decided, and the screen has nowhere to send while it is. */
const mockDepositWalletId = { current: "wallet-invest" }

/** The invoice the recipient's account answers with, carrying the amount inside it. */
const mockRequestInvoice = jest.fn()

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-invoice",
  () => ({
    useInvestmentInvoice: () => ({
      requestInvoice: (...args: unknown[]) => mockRequestInvoice(...args),
      isRequesting: false,
    }),
  }),
)

jest.mock("@app/config/feature-flags-context", () => {
  const actual = jest.requireActual("@app/config/feature-flags-context")
  return {
    ...actual,
    useRemoteConfig: () => ({
      ...actual.defaultRemoteConfig,
      cardInvestmentDepositBtcWalletId: mockDepositWalletId.current,
    }),
  }
})

/** The wallets and the price feed, answered by their own hook; its spec covers how the
 *  balance is worked out, so what matters here is which way the screen routes on it. */
const mockFunding = {
  current: {
    balanceUsd: 0,
    shortfallUsd: 0,
    hasEnoughBalance: false,
    totalSats: 0,
    isLoading: false,
  },
}

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding",
  () => ({
    useInvestmentFunding: () => mockFunding.current,
  }),
)

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: () => ({ params: mockRouteParams.current }),
  }
})

describe("TransferInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockDepositWalletId.current = "wallet-invest"
    mockRequestInvoice.mockResolvedValue({ paymentRequest: "lnbc-invoice" })
    mockFunding.current = {
      balanceUsd: 0,
      shortfallUsd: SELECTED_AMOUNT_USD,
      hasEnoughBalance: false,
      totalSats: 0,
      isLoading: false,
    }
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays transfer title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Transfer your investment")).toBeTruthy()
  })

  it("names the units the agreement was signed for", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(/You have signed the subscription agreement for 25,000 units/),
    ).toBeTruthy()
  })

  it("asks for the amount the investor chose", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/Time to transfer the investment amount of \$25,000/)).toBeTruthy()
  })

  /** Asking for one amount after signing for another is the failure worth guarding. */
  it("follows a different choice through both paragraphs", async () => {
    mockRouteParams.current = { selectedAmountUsd: 1000 }

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(/You have signed the subscription agreement for 1,000 units/),
    ).toBeTruthy()
    expect(getByText(/Time to transfer the investment amount of \$1,000/)).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Continue")).toBeTruthy()
  })

  it("sends a short investor to the shortfall screen, with the amount they chose", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingInsufficientBalanceScreen", {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
    })
  })

  /** The screen used to route here whatever the balance was, so an investor holding the
   *  full amount was told they were short. */
  it("opens the send flow when the investment is covered", async () => {
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 31_704_000)
    expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
      payment: "lnbc-invoice",
    })
  })

  /**
   * The agreement fixes a rate at the moment it is signed and names the bitcoin owed
   * against it. Converting the dollars again at today's price would charge a different
   * amount than the signed document states, so the figure it carries wins.
   */
  it("bills the satoshis the agreement names, not today's conversion", async () => {
    mockRouteParams.current = {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
      settlementSats: 12_682_228,
    }
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 12_682_228)
  })

  /** Opening the send flow on nothing would leave the investor on an empty destination
   *  with no idea why. */
  it("says so and stays put when the invoice cannot be issued", async () => {
    mockRequestInvoice.mockResolvedValue(null)
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockNavigate).not.toHaveBeenCalled()
    expect(getByText(/Failed to generate invoice/)).toBeTruthy()
  })

  /** Acting on a balance that has not arrived would tell an investor with the money that
   *  they are short. */
  it("does nothing while the balance is still loading", async () => {
    mockFunding.current = {
      balanceUsd: 0,
      shortfallUsd: SELECTED_AMOUNT_USD,
      hasEnoughBalance: false,
      totalSats: 31_704_000,
      isLoading: true,
    }

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** With the money ready and nowhere to send it, the send flow would open on an empty
   *  destination. The shortfall path needs no address, so it stays reachable. */
  it("holds the send when no deposit address is configured", async () => {
    mockDepositWalletId.current = ""
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("still reaches the shortfall screen with no deposit address configured", async () => {
    mockDepositWalletId.current = ""

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingInsufficientBalanceScreen", {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
    })
  })
})
