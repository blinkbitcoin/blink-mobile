import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { WAIT_TIMEOUT_MS } from "@app/screens/card-screen/onboarding/investment-flow/use-given-up-waiting"
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

/** The record the home reads to hold the invitation open; its own spec covers the
 *  record, so what matters here is when this screen writes it, and where it sends an
 *  investor the record says has moved on. */
const mockMarkInvited = jest.fn()
const mockRefetchAccount = jest.fn()
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
    markInvited: mockMarkInvited,
    refetchAccount: mockRefetchAccount,
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

    const { getByText } = render(
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
    expect(mockMarkInvited).not.toHaveBeenCalled()
    /** Nor is the button live in the frame before the reset lands. */
    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })
    expect(mockNavigate).not.toHaveBeenCalled()
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

  /** The account is usually in the cache; when it is not and does not come, a grey
   *  button with no reason is a dead end. The wait ends the way the signing step's does. */
  describe("when the account does not come", () => {
    beforeEach(() => {
      jest.useFakeTimers()
      mockIsAccountResolved.current = false
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    const renderAndWaitOut = async () => {
      const utils = render(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      act(() => {
        jest.advanceTimersByTime(WAIT_TIMEOUT_MS)
      })
      return utils
    }

    it("says the connection was lost and offers to try again", async () => {
      const { getByText, queryByText } = await renderAndWaitOut()

      expect(getByText(/Connection lost/)).toBeTruthy()
      expect(getByText("Try Again")).toBeTruthy()
      expect(queryByText("Continue")).toBeNull()
    })

    it("says nothing before the wait has run out", async () => {
      const { queryByText, getByText } = render(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      act(() => {
        jest.advanceTimersByTime(WAIT_TIMEOUT_MS - 1)
      })

      expect(queryByText(/Connection lost/)).toBeNull()
      expect(getByText("Continue")).toBeTruthy()
    })

    /** A fetch that failed offline is not retried on its own, so trying again asks the
     *  server for the account and waits the full time once more. */
    it("asks for the account again and waits anew on Try Again", async () => {
      const { getByText, queryByText } = await renderAndWaitOut()

      await act(async () => {
        fireEvent.press(getByText("Try Again"))
      })

      expect(mockRefetchAccount).toHaveBeenCalledTimes(1)
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(queryByText(/Connection lost/)).toBeNull()
      act(() => {
        jest.advanceTimersByTime(WAIT_TIMEOUT_MS - 1)
      })
      expect(queryByText(/Connection lost/)).toBeNull()
      act(() => {
        jest.advanceTimersByTime(1)
      })
      expect(getByText(/Connection lost/)).toBeTruthy()
    })

    it("goes back to Continue once the account arrives", async () => {
      const { getByText, queryByText, rerender } = await renderAndWaitOut()

      mockIsAccountResolved.current = true
      rerender(
        <ContextForScreen>
          <WelcomeInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})

      expect(queryByText("Try Again")).toBeNull()
      expect(queryByText(/Connection lost/)).toBeNull()
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
      expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingCompanyValuationScreen")
    })
  })

  /** Opening this screen is what records the invitation, whichever way it was opened,
   *  so an investor who leaves before signing keeps a way back from the home. */
  it("records the invitation as soon as it is shown", async () => {
    render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(mockMarkInvited).toHaveBeenCalledTimes(1)
  })

  /** A write with no account to file it under is dropped by the record, so the screen
   *  waits for the account rather than writing into the void. */
  it("waits for the account before recording the invitation", async () => {
    mockIsAccountResolved.current = false

    const { rerender } = render(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})
    expect(mockMarkInvited).not.toHaveBeenCalled()

    mockIsAccountResolved.current = true
    rerender(
      <ContextForScreen>
        <WelcomeInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockMarkInvited).toHaveBeenCalledTimes(1)
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
