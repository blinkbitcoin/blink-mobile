import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { logError } from "@app/utils/log-error"
import { SignInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/sign-invest-screen"

import { ContextForScreen } from "../../../helper"

const TEST_FORM_URL = "https://forms.example.test/investment-agreement"
/** The amount the user picked two screens earlier, which the agreement is written from. */
const SELECTED_AMOUNT_USD = 25000
const TEST_ALLOWED_ORIGIN = "https://apps.example.test"

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

/** A round $100,000 per bitcoin, read through a getter so a test can render the screen
 *  before the price feed has answered. */
const mockUsdPerSat: { current: string | null } = { current: "0.00100000" }

/** Partial: the module also exports SATS_PER_BTC, which the terms are quoted with. */
jest.mock("@app/hooks/use-price-conversion", () => ({
  ...jest.requireActual("@app/hooks/use-price-conversion"),
  usePriceConversion: () => ({ usdPerSat: mockUsdPerSat.current }),
}))

/** Read through a getter so a test can arrive on the route with a different choice. */
const mockRouteParams = { current: { selectedAmountUsd: SELECTED_AMOUNT_USD } }

const mockNavigate = jest.fn()
const mockReplace = jest.fn()
const mockGoBack = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      replace: mockReplace,
      goBack: mockGoBack,
    }),
    useRoute: () => ({ params: mockRouteParams.current }),
  }
})

jest.mock("@app/config", () => {
  const actual = jest.requireActual("@app/config")
  return {
    ...actual,
    ESIGN_ALLOWED_ORIGIN: "https://apps.example.test",
  }
})

/** Read through a getter so a test can render the screen with a different form published. */
const mockFormUrl = { current: TEST_FORM_URL }

jest.mock("@app/config/feature-flags-context", () => {
  const actual = jest.requireActual("@app/config/feature-flags-context")
  return {
    ...actual,
    useRemoteConfig: () => ({
      ...actual.defaultRemoteConfig,
      cardInvestmentEsignFormUrl: mockFormUrl.current,
    }),
  }
})

type SigningStatus = "idle" | "loading" | "signing" | "success" | "error" | "offline"

/**
 * Stands in for the library's state machine, which is tested in its own repo. What matters
 * here is the contract between the screen and it: the source and callbacks it is handed,
 * which action each state offers, and that the session starts without a second tap.
 */
const mockESign = {
  options: null as Record<string, unknown> | null,
  status: "idle" as SigningStatus,
  error: null as { code: string; message: string } | null,
  isSessionExpired: false,
  isCheckingConnection: false,
  webViewProps: null as Record<string, unknown> | null,
  sign: jest.fn(),
  cancel: jest.fn(),
  retry: jest.fn(),
  restart: jest.fn(),
  checkConnection: jest.fn(),
  /** Mirrors the real hook, where `sign` is rebuilt whenever the source is: a stand-in
   *  that handed back one stable function would hide the double start a rebuilt source
   *  causes. Calls still land on `sign`, so tests count them there. */
  signSource: null as unknown,
  signForSource: (() => {}) as () => void,
}

jest.mock("@blinkbitcoin/esign-react-native/webform", () => {
  /** The source factory and the error copy are the real ones, taken from the
   *  platform-agnostic core so no native module is dragged into the test. */
  const core = jest.requireActual("@blinkbitcoin/esign-core/webform")

  return {
    createPublicUrlSource: core.createPublicUrlSource,
    getErrorMessage: core.getErrorMessage,
    useESignature: (options: Record<string, unknown>) => {
      mockESign.options = options

      if (mockESign.signSource !== options.source) {
        mockESign.signSource = options.source
        mockESign.signForSource = () => mockESign.sign()
      }

      return {
        status: mockESign.status,
        error: mockESign.error,
        isSessionExpired: mockESign.isSessionExpired,
        isCheckingConnection: mockESign.isCheckingConnection,
        webViewProps: mockESign.webViewProps,
        sign: mockESign.signForSource,
        cancel: mockESign.cancel,
        retry: mockESign.retry,
        restart: mockESign.restart,
        checkConnection: mockESign.checkConnection,
      }
    },
  }
})

const renderScreen = async () => {
  const utils = render(
    <ContextForScreen>
      <SignInvestScreen />
    </ContextForScreen>,
  )

  await act(async () => {})

  return utils
}

/** DocuSign reads prefilled values off the fragment, not the query string. */
const prefillOf = (url: string): URLSearchParams =>
  new URLSearchParams(new URL(url).hash.slice(1))

const startedSession = async (): Promise<{ url: string; allowedOrigin?: string }> => {
  const source = mockESign.options?.source as {
    start: () => Promise<{ url: string; allowedOrigin?: string }>
  }
  return source.start()
}

describe("SignInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockESign.options = null
    mockESign.status = "idle"
    mockESign.error = null
    mockESign.isSessionExpired = false
    mockESign.isCheckingConnection = false
    mockESign.webViewProps = null
    mockESign.signSource = null
    mockFormUrl.current = TEST_FORM_URL
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockUsdPerSat.current = "0.00100000"
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()

    expect(toJSON()).toBeTruthy()
  })

  /**
   * The signer already chose to sign on the Term Sheet, so a second gate would ask the
   * same question twice. This is what Lukas asked for and what headless mode buys.
   */
  it("starts the session as the screen opens, with no second tap", async () => {
    await renderScreen()

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
  })

  it("does not start a second session once one is under way", async () => {
    mockESign.status = "loading"

    await renderScreen()

    expect(mockESign.sign).not.toHaveBeenCalled()
  })

  /**
   * The form keeps the figures it opened with, so opening before the feed answers signs
   * an agreement with no rate, no settlement and no stamp. Seen on device: the three
   * fields arrived blank.
   */
  it("waits for the price before opening the form", async () => {
    mockUsdPerSat.current = null

    await renderScreen()

    expect(mockESign.sign).not.toHaveBeenCalled()
  })

  it("opens the form as soon as the price answers", async () => {
    mockUsdPerSat.current = null

    const { rerender } = await renderScreen()

    mockUsdPerSat.current = "0.00100000"

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
    expect(prefillOf((await startedSession()).url).get("btc_usd_rate")).toBe("100000")
  })

  /** A feed that never answers must not strand the step: the three BTC figures are
   *  optional by design, so the agreement is still signable without them. */
  it("opens the form without the price once the wait runs out", async () => {
    jest.useFakeTimers()
    mockUsdPerSat.current = null

    try {
      await renderScreen()

      expect(mockESign.sign).not.toHaveBeenCalled()

      await act(async () => {
        jest.advanceTimersByTime(5000)
      })

      expect(mockESign.sign).toHaveBeenCalledTimes(1)
      expect(prefillOf((await startedSession()).url).get("btc_usd_rate")).toBeNull()
    } finally {
      jest.useRealTimers()
    }
  })

  /**
   * The first call spends a moment checking connectivity, and a price arriving in that
   * window rebuilds the source. Without a guard the effect fires again on the rebuilt
   * source and two sessions start, the second landing on top of the first.
   */
  it("starts one session even when the price arrives mid-start", async () => {
    mockUsdPerSat.current = null

    const { rerender } = await renderScreen()

    mockUsdPerSat.current = "0.00100000"

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
  })

  /** Leaving idle clears the guard, so the retry the failure screen offers is not a
   *  button that starts nothing. */
  it("starts again when a retry brings it back to idle", async () => {
    mockESign.status = "error"
    mockESign.error = { code: "PROVIDER_UNAVAILABLE", message: "nope" }

    const { rerender } = await renderScreen()

    expect(mockESign.sign).not.toHaveBeenCalled()

    mockESign.status = "idle"
    mockESign.error = null

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
  })

  it("builds the source from the remote-config form url and the allowed origin", async () => {
    await renderScreen()

    const session = await startedSession()

    expect(session.url.startsWith(TEST_FORM_URL)).toBe(true)
    expect(session.allowedOrigin).toBe(TEST_ALLOWED_ORIGIN)
  })

  /**
   * The user already chose the amount two screens back, so the form must not ask again:
   * a different answer there would put an investment they never picked into a signed
   * agreement.
   */
  it("prefills the agreement's figures from the amount the user chose", async () => {
    await renderScreen()

    const prefill = prefillOf((await startedSession()).url)

    expect(prefill.get("total_subscription_usd")).toBe("25000")
    expect(prefill.get("number_of_units")).toBe("25000")
    expect(prefill.get("price_per_unit_usd")).toBe("1")
    expect(prefill.get("pre_money_valuation_usd")).toBe("10000000")
  })

  /** The agreement is written from the figure the investor picked, so a form that always
   *  carried the same one would document an investment nobody chose. */
  it("carries a different choice through to the form", async () => {
    mockRouteParams.current = { selectedAmountUsd: 1000 }

    await renderScreen()

    const prefill = prefillOf((await startedSession()).url)

    expect(prefill.get("total_subscription_usd")).toBe("1000")
    expect(prefill.get("number_of_units")).toBe("1000")
  })

  /** The agreement fixes the rate its payment is owed at, so the app quotes it rather than
   *  asking an investor who has no way to know it. */
  it("prefills the settlement figures from the app's own price", async () => {
    await renderScreen()

    const prefill = prefillOf((await startedSession()).url)

    expect(prefill.get("btc_usd_rate")).toBe("100000")
    expect(prefill.get("settlement_amount_btc")).toBe("0.25")
    expect(prefill.get("rate_timestamp")).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
  })

  /**
   * The price feed polls. Following it would rewrite the url on every tick and restart the
   * signing session, possibly mid-signature, and the agreement fixes ONE rate at one
   * stamped moment anyway, so the first quote is the one that holds.
   */
  it("holds the first rate it quoted when the price moves", async () => {
    const { rerender } = await renderScreen()

    const firstSource = mockESign.options?.source
    const firstPrefill = prefillOf((await startedSession()).url)

    mockUsdPerSat.current = "0.00200000"

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockESign.options?.source).toBe(firstSource)
    expect(prefillOf((await startedSession()).url).get("btc_usd_rate")).toBe(
      firstPrefill.get("btc_usd_rate"),
    )
  })

  /** An invented rate would be worse than none, so before the feed answers those three
   *  figures are simply absent and the rest still travels. */
  it("omits the settlement figures until the price feed answers", async () => {
    mockUsdPerSat.current = null

    await renderScreen()

    const prefill = prefillOf((await startedSession()).url)

    expect(prefill.get("btc_usd_rate")).toBeNull()
    expect(prefill.get("settlement_amount_btc")).toBeNull()
    expect(prefill.get("rate_timestamp")).toBeNull()
    expect(prefill.get("total_subscription_usd")).toBe("25000")
  })

  /** Who the subscriber is stays theirs to answer: the app knows the money, not the
   *  person, and personal data has no business riding in a URL. */
  it("leaves the subscriber's own details out of the url", async () => {
    await renderScreen()

    const prefill = prefillOf((await startedSession()).url)

    expect(prefill.get("full_legal_name")).toBeNull()
    expect(prefill.get("country_of_residence")).toBeNull()
    expect(prefill.get("email")).toBeNull()
  })

  it("keeps the same source across re-renders so the session is not restarted", async () => {
    const { rerender } = await renderScreen()

    const firstSource = mockESign.options?.source

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockESign.options?.source).toBe(firstSource)
  })

  it("rebuilds the source when a different form is published", async () => {
    const { rerender } = await renderScreen()

    const firstSource = mockESign.options?.source
    mockFormUrl.current = "https://forms.example.test/second-agreement"

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockESign.options?.source).not.toBe(firstSource)
    expect(
      (await startedSession()).url.startsWith(
        "https://forms.example.test/second-agreement",
      ),
    ).toBe(true)
  })

  describe("what the signer sees", () => {
    it("shows the form itself once the session is under way", async () => {
      mockESign.status = "signing"
      mockESign.webViewProps = { source: { uri: TEST_FORM_URL } }

      const { getByTestId } = await renderScreen()

      expect(getByTestId("sign-invest-webview")).toBeTruthy()
    })

    it("waits on a spinner while the session is being opened", async () => {
      mockESign.status = "loading"

      const { getByTestId, queryByTestId } = await renderScreen()

      expect(getByTestId("sign-invest-loading")).toBeTruthy()
      expect(queryByTestId("sign-invest-webview")).toBeNull()
    })

    /** The library holds the success state briefly before it calls onComplete, and an
     *  empty screen in that gap would read as the flow having stalled. */
    it("keeps the spinner up while the signed session settles", async () => {
      mockESign.status = "success"

      const { getByTestId } = await renderScreen()

      expect(getByTestId("sign-invest-loading")).toBeTruthy()
    })

    /** Offline is a state with a way out, not a dead end: the signer checks the
     *  connection and the session starts again on its own. */
    it("offers to check the connection when the device is offline", async () => {
      mockESign.status = "offline"

      const { getByText } = await renderScreen()

      expect(getByText(/Connection lost/)).toBeTruthy()

      await act(async () => {
        fireEvent.press(getByText("Try Again"))
      })

      expect(mockESign.checkConnection).toHaveBeenCalledTimes(1)
    })

    it("words a failure with the library's own copy for its code", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "PROVIDER_UNAVAILABLE", message: "nope" }

      const { getByText } = await renderScreen()

      expect(getByText("Error")).toBeTruthy()
      expect(getByText(/Signing service temporarily unavailable/)).toBeTruthy()
    })

    it("retries a failed session", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "PROVIDER_UNAVAILABLE", message: "nope" }

      const { getByText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByText("Try Again"))
      })

      expect(mockESign.retry).toHaveBeenCalledTimes(1)
      expect(mockESign.restart).not.toHaveBeenCalled()
    })

    /** An expired session keeps its envelope, so it is restarted rather than retried:
     *  a retry would drop what the signer already filled in. */
    it("restarts an expired session instead of retrying it", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "SESSION_EXPIRED", message: "expired" }
      mockESign.isSessionExpired = true

      const { getByText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByText("Try Again"))
      })

      expect(mockESign.restart).toHaveBeenCalledTimes(1)
      expect(mockESign.retry).not.toHaveBeenCalled()
    })
  })

  describe("where each outcome leads", () => {
    const callbackOf = (name: string) =>
      mockESign.options?.[name] as (arg?: never) => void

    it("advances to the transfer step once the agreement is signed", async () => {
      await renderScreen()

      await act(async () => {
        callbackOf("onComplete")()
      })

      expect(mockReplace).toHaveBeenCalledWith("cardOnboardingTransferInvestScreen", {
        selectedAmountUsd: SELECTED_AMOUNT_USD,
      })
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    it("returns to the term sheet when the signer cancels", async () => {
      await renderScreen()

      await act(async () => {
        callbackOf("onCancel")()
      })

      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(mockReplace).not.toHaveBeenCalled()
    })

    /** The retry lives on this screen, so navigating away on a failure would take it
     *  with it. Leaving is the close button's job. */
    it("stays on the step when signing fails", async () => {
      await renderScreen()

      await act(async () => {
        callbackOf("onError")({
          code: "ENVELOPE_CREATION_FAILED",
          message: "nope",
        } as never)
      })

      expect(mockGoBack).not.toHaveBeenCalled()
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
    })

    it("reports the failure with its error code", async () => {
      await renderScreen()

      await act(async () => {
        callbackOf("onError")({
          code: "ENVELOPE_CREATION_FAILED",
          message: "nope",
        } as never)
      })

      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          scope: "card-investment-esign",
          context: { code: "ENVELOPE_CREATION_FAILED" },
        }),
      )
    })
  })
})
