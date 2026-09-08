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

describe("TransferInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
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

  it("navigates to the insufficient balance screen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Continue")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingInsufficientBalanceScreen")
  })
})
