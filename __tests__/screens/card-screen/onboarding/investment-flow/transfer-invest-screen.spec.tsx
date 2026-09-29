import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { TransferInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/transfer-invest-screen"
import { CardInvestmentPaymentLookup } from "@app/types/card-investment"
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
const mockMarkPaid = jest.fn()
/** Whether the active account can take part: false for a self-custodial one. */
const mockIsEligible = { current: true }
/** The account the invoice is filed under; null while the home has not resolved it. */
const ACCOUNT_ID = "0f1e2d3c-4b5a-4968-8776-655443322110"
const mockAccountId: { current: string | null } = { current: ACCOUNT_ID }

jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    progress: mockCardInvestmentProgress.current,
    recordInvoice: (...args: unknown[]) => mockRecordInvoice(...args),
    markPaid: () => mockMarkPaid(),
    isEligible: mockIsEligible.current,
    accountId: mockAccountId.current,
    isAccountResolved: mockAccountId.current !== null,
  }),
}))

const mockDispatch = jest.fn()

/** Whether the step is still in front when the invoice comes back. */
const mockIsFocused = { current: true }

/** What the ledger says about the invoice on record: settled, pending, or nothing. */
const mockLookUpPayment = jest.fn()
jest.mock(
  "@app/screens/card-screen/onboarding/investment-flow/investment-payment-lookup",
  () => ({
    useLookUpInvestmentPayment: () => (paymentRequest: string) =>
      mockLookUpPayment(paymentRequest),
  }),
)

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
type MockFunding = {
  balanceUsd: number
  shortfallUsd: number
  hasEnoughBalance: boolean
  balanceWalletId?: string
  totalSats: number
  isLoading: boolean
}
const mockFunding: { current: MockFunding } = {
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

/** Every spec starts from a signed, unpaid investor with nothing issued yet. */
const resetScreenMocks = () => {
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
  mockLookUpPayment.mockResolvedValue(CardInvestmentPaymentLookup.NotFound)
  mockFunding.current = {
    balanceUsd: 0,
    shortfallUsd: SELECTED_AMOUNT_USD,
    hasEnoughBalance: false,
    totalSats: 0,
    isLoading: false,
  }
  jest.clearAllMocks()
}

describe("TransferInvestScreen", () => {
  beforeEach(resetScreenMocks)

  /** An invoice minted with no agreement behind it would be paid with nothing to record
   *  the payment on, so the step leaves for the home. */
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

  /** The record is only readable once the account is known; a tap before that has no
   *  agreement to act on, so it goes home, where the card returns once the record loads,
   *  rather than into a shortfall step for an investment it cannot name. */
  it("leaves for the home on a tap before the record can be read", async () => {
    mockCardInvestmentProgress.current = null
    mockAccountId.current = null

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
    expect(mockNavigate).not.toHaveBeenCalled()
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
    mockCardInvestmentProgress.current = { selectedAmountUsd: 1000, signedAt: Date.now() }

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

  /**
   * The record is what the invoice is filed under and what the payment is later found
   * by, so its figures win over a route that disagrees: an old link, or one edited by
   * hand, must not bill a different amount than the one signed for.
   */
  it("reads the amount off the signed record over the route", async () => {
    mockRouteParams.current = { selectedAmountUsd: 1000, settlementSats: 1_268_222 }
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

    expect(
      getByText(/You have signed the subscription agreement for 25,000 units/),
    ).toBeTruthy()
    expect(mockUseInvestmentFunding).toHaveBeenCalledWith(SELECTED_AMOUNT_USD, 12_682_228)

    await act(async () => {
      fireEvent.press(getByText("Continue"))
    })

    expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 12_682_228, {
      accountId: ACCOUNT_ID,
      amountUsd: SELECTED_AMOUNT_USD,
    })
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
      sendingWalletId: undefined,
    })
  })

  /** The wallet judged to cover the investment is the one the payment is made from:
   *  left to its default the send flow may pick the other wallet and refuse the amount
   *  this step just said could be paid. */
  it("opens the send flow on the wallet that was judged to cover the investment", async () => {
    mockFunding.current = {
      balanceUsd: SELECTED_AMOUNT_USD,
      shortfallUsd: 0,
      hasEnoughBalance: true,
      balanceWalletId: "wallet-usd",
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

    expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
      payment: "lnbc-invoice",
      sendingWalletId: "wallet-usd",
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
})

describe("TransferInvestScreen, the invoice it pays", () => {
  beforeEach(resetScreenMocks)

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

    const expiredInvoice = () => {
      mockCardInvestmentProgress.current = {
        selectedAmountUsd: SELECTED_AMOUNT_USD,
        signedAt: Date.now(),
        invoice: {
          paymentRequest: "lnbc-issued-before",
          issuedAt: NOW_MS - 26 * 60 * 1000,
        },
      }
    }

    /** An invoice the ledger has no trace of was never paid; the ledger cannot refuse
     *  a second invoice for the same investment, so the step asks before it mints. */
    it("mints afresh once the issued invoice is too old to pay in time and was never paid", async () => {
      expiredInvoice()

      await pressContinue()

      expect(mockLookUpPayment).toHaveBeenCalledWith("lnbc-issued-before")
      expect(mockRequestInvoice).toHaveBeenCalledWith("wallet-invest", 31_704_000, {
        accountId: ACCOUNT_ID,
        amountUsd: SELECTED_AMOUNT_USD,
      })
      expect(mockRecordInvoice).toHaveBeenCalledWith("lnbc-invoice")
    })

    /**
     * The app was killed with the payment in flight, the receipt never recorded it, and
     * the investor came back after the invoice expired: the ledger says it settled. A
     * fresh invoice here would be paid a second time, so the payment is recorded and the
     * home takes over with its welcome.
     */
    it("records the payment and leaves for the home when the ledger says the old invoice settled", async () => {
      expiredInvoice()
      mockLookUpPayment.mockResolvedValue(CardInvestmentPaymentLookup.Settled)

      await pressContinue()

      expect(mockMarkPaid).toHaveBeenCalledTimes(1)
      expect(mockRequestInvoice).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RESET",
          payload: { index: 0, routes: [{ name: "Primary" }] },
        }),
      )
    })

    /** A pending payment has left the wallet; like the receipt, the step records it as
     *  paid rather than mint a second invoice for money already on its way. */
    it("records the payment when the ledger still holds it as pending", async () => {
      expiredInvoice()
      mockLookUpPayment.mockResolvedValue(CardInvestmentPaymentLookup.Pending)

      await pressContinue()

      expect(mockMarkPaid).toHaveBeenCalledTimes(1)
      expect(mockRequestInvoice).not.toHaveBeenCalled()
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: "RESET" }),
      )
    })

    /** Not being able to ask the ledger is not an unpaid invoice: the old one may have
     *  been paid, so nothing is minted and the investor is told to try again. */
    it("mints nothing and says so when the ledger could not be asked", async () => {
      expiredInvoice()
      mockLookUpPayment.mockResolvedValue(CardInvestmentPaymentLookup.Unknown)

      const { getByText, queryByText } = render(
        <ContextForScreen>
          <TransferInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(mockRequestInvoice).not.toHaveBeenCalled()
      expect(mockRecordInvoice).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockDispatch).not.toHaveBeenCalled()
      expect(
        getByText("Connection lost. Please check your network and try again."),
      ).toBeTruthy()
      expect(queryByText(/Failed to generate invoice/)).toBeNull()
    })

    it("mints once the ledger answers on a second try, and clears the line", async () => {
      expiredInvoice()
      mockLookUpPayment
        .mockResolvedValueOnce(CardInvestmentPaymentLookup.Unknown)
        .mockResolvedValueOnce(CardInvestmentPaymentLookup.NotFound)

      const { getByText, queryByText } = render(
        <ContextForScreen>
          <TransferInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(mockRequestInvoice).toHaveBeenCalledTimes(1)
      expect(
        queryByText("Connection lost. Please check your network and try again."),
      ).toBeNull()
      expect(mockNavigate).toHaveBeenCalledWith("sendBitcoinDestination", {
        payment: "lnbc-invoice",
      })
    })

    /** An invoice still payable is paid as it is; the ledger is not asked about it. */
    it("does not ask the ledger about an invoice that can still be paid", async () => {
      mockCardInvestmentProgress.current = {
        selectedAmountUsd: SELECTED_AMOUNT_USD,
        signedAt: Date.now(),
        invoice: {
          paymentRequest: "lnbc-issued-before",
          issuedAt: NOW_MS - 20 * 60 * 1000,
        },
      }

      await pressContinue()

      expect(mockLookUpPayment).not.toHaveBeenCalled()
    })

    it("does not ask the ledger when no invoice was ever issued", async () => {
      await pressContinue()

      expect(mockLookUpPayment).not.toHaveBeenCalled()
    })

    /** The investor left the step while the ledger was being asked; the home must not
     *  be reset over whatever they moved on to. */
    it("does nothing with the ledger's answer once the step was left", async () => {
      expiredInvoice()
      let answer: (value: CardInvestmentPaymentLookup) => void = () => {}
      mockLookUpPayment.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )

      await pressContinue()
      mockIsFocused.current = false
      await act(async () => {
        answer(CardInvestmentPaymentLookup.Settled)
      })

      expect(mockMarkPaid).toHaveBeenCalledTimes(1)
      expect(mockDispatch).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    /** The button shows it is busy while the ledger is asked, as it does while minting. */
    it("holds the button while the ledger is asked", async () => {
      expiredInvoice()
      let answer: (value: CardInvestmentPaymentLookup) => void = () => {}
      mockLookUpPayment.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )

      const { getByText, getByRole } = render(
        <ContextForScreen>
          <TransferInvestScreen />
        </ContextForScreen>,
      )
      await act(async () => {})
      await act(async () => {
        fireEvent.press(getByText("Continue"))
      })

      expect(getByRole("button", { busy: true })).toBeTruthy()

      await act(async () => {
        answer(CardInvestmentPaymentLookup.NotFound)
      })
      expect(mockRequestInvoice).toHaveBeenCalledTimes(1)
    })

    it("records nothing when no invoice came back", async () => {
      mockRequestInvoice.mockResolvedValue(null)

      await pressContinue()

      expect(mockRecordInvoice).not.toHaveBeenCalled()
    })
  })
})
