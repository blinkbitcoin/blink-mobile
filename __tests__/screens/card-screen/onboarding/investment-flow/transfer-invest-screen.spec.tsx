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

/** An amount the screen could not get right by accident: the figures below only match it
 *  when they are derived from the route. */
const SELECTED_AMOUNT_USD = 25000

const mockRouteParams: {
  current: { selectedAmountUsd: number; settlementSats?: number }
} = { current: { selectedAmountUsd: SELECTED_AMOUNT_USD } }

/** The wallet the investment is paid into, which ops sets remotely; empty until that
 *  account is decided, and the screen has nowhere to send while it is. */
const mockDepositWalletId = { current: "wallet-invest" }

/** The invoice the recipient's account answers with, carrying the amount inside it. */
const mockRequestInvoice = jest.fn()

/** The signed record, which carries the settlement figure when the route does not. */
const mockCardInvestmentProgress: {
  current: {
    selectedAmountUsd: number
    signedAt: number
    settlementSats?: number
    invoice?: { paymentRequest: string; issuedAt: number }
  } | null
} = { current: null }
const mockRecordInvoice = jest.fn()
/** Whether the active account can take part: false for a self-custodial one. */
const mockIsEligible = { current: true }
/** The account the invoice is filed under; null while the home has not resolved it. */
const ACCOUNT_ID = "0f1e2d3c-4b5a-4968-8776-655443322110"
const mockAccountId: { current: string | null } = { current: ACCOUNT_ID }

jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    progress: mockCardInvestmentProgress.current,
    recordInvoice: (...args: unknown[]) => mockRecordInvoice(...args),
    isEligible: mockIsEligible.current,
    accountId: mockAccountId.current,
    isAccountResolved: mockAccountId.current !== null,
  }),
}))

const mockDispatch = jest.fn()

/** Whether the step is still in front when the invoice comes back. */
const mockIsFocused = { current: true }

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-invoice",
  () => ({
    ...jest.requireActual(
      "@app/screens/card-screen/onboarding/investment-flow/use-investment-invoice",
    ),
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

const mockUseInvestmentFunding = jest.fn(
  (_totalUsd: number, _settlementSats?: number) => mockFunding.current,
)

jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/use-investment-funding",
  () => ({
    useInvestmentFunding: (totalUsd: number, settlementSats?: number) =>
      mockUseInvestmentFunding(totalUsd, settlementSats),
    useInvestmentSats: () => mockFunding.current.totalSats,
  }),
)

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      dispatch: mockDispatch,
      isFocused: () => mockIsFocused.current,
    }),
    useRoute: () => ({ params: mockRouteParams.current }),
  }
})

describe("TransferInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockDepositWalletId.current = "wallet-invest"
    mockCardInvestmentProgress.current = {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
      signedAt: Date.now(),
    }
    mockIsFocused.current = true
    mockIsEligible.current = true
    mockAccountId.current = ACCOUNT_ID
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

  /** A record that lapsed while the step was open would let an invoice be minted and
   *  paid with nothing left to record the payment on, so the step leaves for the home. */
  it("sends an account with no signed agreement home instead of issuing an invoice", async () => {
    mockCardInvestmentProgress.current = null
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }

    render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Primary" }] },
      }),
    )
    expect(mockRequestInvoice).not.toHaveBeenCalled()
  })

  /** The record is read at render; if its day runs out before the tap, minting on it
   *  would pay an invoice the receipt can no longer record. */
  it("leaves for the home on a tap after the record's day ran out", async () => {
    mockCardInvestmentProgress.current = {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
      signedAt: Date.now() - 25 * 60 * 60 * 1000,
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
    expect(mockDispatch).not.toHaveBeenCalled()

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Primary" }] },
      }),
    )
    expect(mockRequestInvoice).not.toHaveBeenCalled()
  })

  /** Until the account is known there is no record to read, and a step just reached
   *  from the signing must not be sent home in that moment. */
  it("stays while the account is still unknown", async () => {
    mockCardInvestmentProgress.current = null
    mockAccountId.current = null

    render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockDispatch).not.toHaveBeenCalled()
  })

  /** The step can be reached by link with an amount in it, and would issue an invoice
   *  for that amount with no agreement behind it; an account that cannot take part in
   *  the investment is sent home before it can, and never asked for one. */
  it("sends a self-custodial account home instead of issuing an invoice", async () => {
    mockIsEligible.current = false
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }

    render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: { index: 0, routes: [{ name: "Primary" }] },
      }),
    )
    expect(mockRequestInvoice).not.toHaveBeenCalled()
  })

  it("keeps a custodial account on the step", async () => {
    render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockDispatch).not.toHaveBeenCalled()
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

  /** An investor holding the full amount is not short, so the shortfall screen is not
   *  where they go. */
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

    expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 31_704_000, {
      accountId: ACCOUNT_ID,
      amountUsd: SELECTED_AMOUNT_USD,
    })
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

    expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 12_682_228, {
      accountId: ACCOUNT_ID,
      amountUsd: SELECTED_AMOUNT_USD,
    })
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

  /** A failure line left over from a first try would sit under a second try that is on
   *  its way to the send flow. */
  it("clears the failure line when a second try goes through", async () => {
    mockRequestInvoice
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ paymentRequest: "lnbc-invoice" })
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }

    const { getByText, queryByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })
    expect(getByText(/Failed to generate invoice/)).toBeTruthy()

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })
    expect(queryByText(/Failed to generate invoice/)).toBeNull()
    expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
      payment: "lnbc-invoice",
    })
  })

  /** The invoice is filed under the paying account; with the money ready and the account
   *  not yet read from the cache, the step waits rather than minting an unfiled one. */
  it("holds the send while the paying account is still unknown", async () => {
    mockAccountId.current = null
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

    expect(mockRequestInvoice).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** The shortfall path files nothing, so an unknown account must not close it. */
  it("still reaches the shortfall screen while the paying account is unknown", async () => {
    mockAccountId.current = null

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
   *  destination. The shortfall path needs no address, so it stays reachable. The
   *  investor is told why the button holds, or a grey button over their own money reads
   *  as the app being broken. */
  it("holds the send and says why when no deposit address is configured", async () => {
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
    expect(
      getByText("Investment payments are not open yet. Please try again later."),
    ).toBeTruthy()
  })

  it("says nothing about payments while the investor is short", async () => {
    mockDepositWalletId.current = ""

    const { queryByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      queryByText("Investment payments are not open yet. Please try again later."),
    ).toBeNull()
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

  /** Once signed, the debt is the satoshis the agreement names; the balance is measured
   *  against those, at today's price, rather than against the dollars chosen. */
  it("measures the balance against the satoshis the agreement names", async () => {
    mockRouteParams.current = {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
      settlementSats: 12_682_228,
    }

    render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockUseInvestmentFunding).toHaveBeenCalledWith(SELECTED_AMOUNT_USD, 12_682_228)
  })

  it("measures against the recorded satoshis when the route carries none", async () => {
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockCardInvestmentProgress.current = {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
      signedAt: Date.now(),
      settlementSats: 12_682_228,
    }

    render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockUseInvestmentFunding).toHaveBeenCalledWith(SELECTED_AMOUNT_USD, 12_682_228)
  })

  /** The route lost the figure (a return from the home, or from a conversion), but the
   *  signed record still has it: the invoice is written for what the document names. */
  it("bills the recorded satoshis when the route carries none", async () => {
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockCardInvestmentProgress.current = {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
      signedAt: Date.now(),
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

    expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 12_682_228, {
      accountId: ACCOUNT_ID,
      amountUsd: SELECTED_AMOUNT_USD,
    })
  })

  /** The investor closed the step while the invoice was being issued: opening the send
   *  flow over whatever they moved on to would be neither expected nor safe. */
  it("does not open the send flow when the step was left mid-request", async () => {
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      totalSats: 31_704_000,
      isLoading: false,
    }
    let releaseInvoice: (value: { paymentRequest: string }) => void = () => {}
    mockRequestInvoice.mockReturnValue(
      new Promise((resolve) => {
        releaseInvoice = resolve
      }),
    )

    const { getByText } = render(
      <ContextForScreen>
        <TransferInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })
    mockIsFocused.current = false
    await act(async () => {
      releaseInvoice({ paymentRequest: "lnbc-invoice" })
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  describe("the invoice it pays", () => {
    const NOW_MS = 1_757_800_000_000
    const covered = () => {
      mockFunding.current = {
        balanceUsd: SELECTED_AMOUNT_USD,
        shortfallUsd: 0,
        hasEnoughBalance: true,
        totalSats: 31_704_000,
        isLoading: false,
      }
    }
    let nowSpy: jest.SpyInstance

    beforeEach(() => {
      covered()
      nowSpy = jest.spyOn(Date, "now").mockReturnValue(NOW_MS)
    })

    afterEach(() => {
      nowSpy.mockRestore()
    })

    const pressContinue = async () => {
      const { getByText } = render(
        <ContextForScreen>
          <TransferInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
    }

    it("records the invoice it was issued, so a return pays the same claim", async () => {
      await pressContinue()

      expect(mockRecordInvoice).toHaveBeenCalledWith("lnbc-invoice")
    })

    /** A payment that went through without the receipt recording it leaves the home
     *  asking again; paying the same invoice meets a claim already settled, where a
     *  fresh one would be paid a second time. */
    it("pays the invoice already issued while it can still be paid, without minting", async () => {
      mockCardInvestmentProgress.current = {
        selectedAmountUsd: SELECTED_AMOUNT_USD,
        signedAt: Date.now(),
        invoice: {
          paymentRequest: "lnbc-issued-before",
          issuedAt: NOW_MS - 20 * 60 * 1000,
        },
      }

      await pressContinue()

      expect(mockRequestInvoice).not.toHaveBeenCalled()
      expect(mockRecordInvoice).not.toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
        payment: "lnbc-issued-before",
      })
    })

    it("mints afresh once the issued invoice is too old to pay in time", async () => {
      mockCardInvestmentProgress.current = {
        selectedAmountUsd: SELECTED_AMOUNT_USD,
        signedAt: Date.now(),
        invoice: {
          paymentRequest: "lnbc-issued-before",
          issuedAt: NOW_MS - 26 * 60 * 1000,
        },
      }

      await pressContinue()

      expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 31_704_000, {
        accountId: ACCOUNT_ID,
        amountUsd: SELECTED_AMOUNT_USD,
      })
      expect(mockRecordInvoice).toHaveBeenCalledWith("lnbc-invoice")
    })

    it("records nothing when no invoice came back", async () => {
      mockRequestInvoice.mockResolvedValue(null)

      await pressContinue()

      expect(mockRecordInvoice).not.toHaveBeenCalled()
    })
  })
})
