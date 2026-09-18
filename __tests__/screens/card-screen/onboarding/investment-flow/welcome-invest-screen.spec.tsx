import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { WelcomeInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/welcome-invest-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()

/** The record the home reads to steer the investor; its own spec covers the record, so
 *  what matters here is where this screen sends an investor the record says has moved on. */
const mockIsAccountResolved = { current: true }
const mockIsEligible = { current: true }
const mockProgress: {
  current: { selectedAmountUsd: number; settlementSats?: number; paidAt?: number } | null
} = { current: null }

jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    progress: mockProgress.current,
    isEligible: mockIsEligible.current,
    isAccountResolved: mockIsAccountResolved.current,
  }),
}))

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      dispatch: mockDispatch,
    }),
  }
})

const SIGNED = { selectedAmountUsd: 25000, settlementSats: 31_704_000 }

describe("WelcomeInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockIsAccountResolved.current = true
    mockIsEligible.current = true
    mockProgress.current = null
    jest.clearAllMocks()
  })

  /** The investment is paid from a custodial balance; a self-custodial account that
   *  arrives here by a link has no part in it, and the record is never written for it. */
  it("sends a self-custodial account home without recording anything", async () => {
    mockIsEligible.current = false
    mockIsAccountResolved.current = false

    render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Primary" }] },
      }),
    )
  })

  /** Every way into the flow lands here, and the screens beyond would let an investor
   *  who already signed sign a second agreement. */
  describe("for an investor who already signed", () => {
    it("resumes at the payment, with the figures the signing recorded", async () => {
      mockProgress.current = SIGNED

      render(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RESET",
          payload: {
            index: 1,
            routes: [
              { name: "Primary" },
              {
                name: "cardOnboardingTransferInvestScreen",
                params: {
                  selectedAmountUsd: SIGNED.selectedAmountUsd,
                  settlementSats: SIGNED.settlementSats,
                },
              },
            ],
          },
        }),
      )
    })

    it("sends a paid investor back to the home, where the welcome is", async () => {
      mockProgress.current = { ...SIGNED, paidAt: 1_757_800_000_000 }

      render(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})

      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RESET",
          payload: { index: 0, routes: [{ name: "Primary" }] },
        }),
      )
    })

    it("stays put for an investor who has not signed", async () => {
      render(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})

      expect(mockDispatch).not.toHaveBeenCalled()
    })

    /** A tap before the record can be read would push the next screen over a welcome
     *  that is about to send the investor elsewhere. */
    it("holds Continue until the account the record is filed under is known", async () => {
      mockIsAccountResolved.current = false

      const { getByText, rerender } = render(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
      expect(mockNavigate).not.toHaveBeenCalled()

      mockIsAccountResolved.current = true
      rerender(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
      expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingCompanyValuationScreen")
    })
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays welcome title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Welcome to become part of Blink")).toBeTruthy()
  })

  it("displays body1 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(/Before we raise more funds from professional investors/),
    ).toBeTruthy()
  })

  it("displays body2 text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(
        "This is a personal invitation. Please do not forward or share publicly.",
      ),
    ).toBeTruthy()
  })

  it("displays continue button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Continue")).toBeTruthy()
  })

  it("navigates to company valuation screen on button press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Continue")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingCompanyValuationScreen")
  })
})
