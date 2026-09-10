import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { InsufficientBalanceScreen } from "@app/screens/card-screen/onboarding/investment-flow"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockNavigate = jest.fn()

/** The amount the investor picked, deliberately not the $10,000 the copy used to
 *  hardcode: a screen that ignored the choice would still read correctly against that. */
const SELECTED_AMOUNT_USD = 25000

const mockRouteParams = { current: { selectedAmountUsd: SELECTED_AMOUNT_USD } }

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

/** The funding is what the wallets and the price feed answer; its own spec covers how it
 *  is worked out, so what matters here is that the screen states what it is given. */
const mockFunding = {
  current: {
    balanceUsd: 3333,
    shortfallUsd: 21667,
    hasEnoughBalance: false,
    isSplitAcrossWallets: false,
    isLoading: false,
  },
}

const mockArmInvestmentConversion = jest.fn()

jest.mock("@app/screens/conversion-flow/drain-conversion", () => ({
  ...jest.requireActual("@app/screens/conversion-flow/drain-conversion"),
  armInvestmentConversion: (...args: unknown[]) => mockArmInvestmentConversion(...args),
}))

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding",
  () => ({
    useInvestmentFunding: () => mockFunding.current,
  }),
)

const renderScreen = async () => {
  const utils = render(
    <ContextForScreen>
      <InsufficientBalanceScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return utils
}

describe("InsufficientBalanceScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockFunding.current = {
      balanceUsd: 3333,
      shortfallUsd: 21667,
      hasEnoughBalance: false,
      isSplitAcrossWallets: false,
      isLoading: false,
    }
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()
    expect(toJSON()).toBeTruthy()
  })

  it("displays the insufficient balance title", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("Insufficient balance")).toBeTruthy()
  })

  it("states the balance the investor actually holds", async () => {
    const { getByText } = await renderScreen()
    expect(getByText(/You only have \$3,333/)).toBeTruthy()
  })

  it("states the shortfall against the amount that was chosen", async () => {
    const { getByText } = await renderScreen()
    expect(
      getByText(
        "Deposit more than $21,667 to your account to reach the investment amount of $25,000.",
      ),
    ).toBeTruthy()
  })

  /** The figures used to be fixed text, so a screen that ignored both the choice and the
   *  wallets would still have passed every assertion above. */
  it("follows a different balance and a different choice", async () => {
    mockRouteParams.current = { selectedAmountUsd: 1000 }
    mockFunding.current = {
      balanceUsd: 250,
      shortfallUsd: 750,
      hasEnoughBalance: false,
      isSplitAcrossWallets: false,
      isLoading: false,
    }

    const { getByText } = await renderScreen()

    expect(getByText(/You only have \$250/)).toBeTruthy()
    expect(
      getByText(
        "Deposit more than $750 to your account to reach the investment amount of $1,000.",
      ),
    ).toBeTruthy()
  })

  it("explains the funds can be in either account", async () => {
    const { getByText } = await renderScreen()
    expect(getByText(/in either of your accounts/)).toBeTruthy()
  })

  it("displays the deposit button", async () => {
    const { getByText } = await renderScreen()
    expect(getByText("Deposit")).toBeTruthy()
  })

  /**
   * Held between the two wallets but not in either: telling this investor to deposit asks
   * them for money they already have. Converting is what makes it payable.
   */
  describe("when the funds are only split across the wallets", () => {
    beforeEach(() => {
      mockFunding.current = {
        balanceUsd: 370,
        shortfallUsd: 130,
        hasEnoughBalance: false,
        isSplitAcrossWallets: true,
        isLoading: false,
      }
    })

    it("says the funds are split instead of asking for a deposit", async () => {
      const { getByText, queryByText } = await renderScreen()

      expect(getByText("Your funds are split")).toBeTruthy()
      expect(queryByText("Insufficient balance")).toBeNull()
      expect(queryByText(/Deposit more than/)).toBeNull()
    })

    it("offers to convert", async () => {
      const { getByText, queryByText } = await renderScreen()

      expect(getByText("Convert")).toBeTruthy()
      expect(queryByText("Deposit")).toBeNull()
    })

    it("opens the conversion flow", async () => {
      const { getByText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByText("Convert"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("conversionDetails")
    })

    /** Without the arm the conversion ends on Home, and the investor has to walk the
     *  flow again from the start, signature included. */
    it("arms the return so the conversion comes back to this investment", async () => {
      const { getByText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByText("Convert"))
      })

      expect(mockArmInvestmentConversion).toHaveBeenCalledWith(SELECTED_AMOUNT_USD)
    })
  })

  it("navigates to the receive screen when deposit is pressed", async () => {
    const { getByText } = await renderScreen()
    await act(async () => {
      fireEvent.press(getByText("Deposit"))
    })
    expect(mockNavigate).toHaveBeenCalledWith("receiveBitcoin")
  })
})
