import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import type { ReactTestInstance } from "react-test-renderer"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { logError } from "@app/utils/log-error"
import { AGREEMENT_LABELS } from "@app/screens/card-screen/onboarding/investment-flow/investment-agreement"
import { SignInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/sign-invest-screen"
import { WAIT_TIMEOUT_MS } from "@app/screens/card-screen/onboarding/investment-flow/use-given-up-waiting"

import { ContextForScreen } from "../../../helper"

/** The amount the user picked two screens earlier, which the agreement is written from. */
const SELECTED_AMOUNT_USD = 25000

/** Where the instance under test says the e-sign service answers. */
const MINT_ORIGIN = "https://esign.example.test"

/** The session the service verifies before it mints. */
const SESSION_TOKEN = "session-token"

/** A round rate the figures can be checked against by hand, in the cents the price feed
 *  is read in: $100,000 per bitcoin, so $25,000 settles at a quarter of a bitcoin. */
const USD_CENTS_PER_BTC = 10_000_000
const SETTLEMENT_SATS = 25_000_000

/** What the service answers with: the envelope's signing url and its id. */
const TEST_INSTANCE_URL = "https://sign.example.test/envelope/1"
const TEST_ENVELOPE_ID = "11111111-2222-3333-4444-555555555555"

/** The host's fields as remote config carries them; nothing here is anyone's data. */
const HOST_COUNTRY_LABEL = "country_of_residence"

const HOST_FIELDS = {
  [AGREEMENT_LABELS.signerName]: "Test Signer",
  [AGREEMENT_LABELS.signerEmail]: "signer@example.test",
  [HOST_COUNTRY_LABEL]: "Testland",
}

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

/** The instance names the service, and the session is what the mint is made as. */
jest.mock("@app/hooks/use-app-config", () => {
  const { GALOY_INSTANCES } = jest.requireActual("@app/config")

  return {
    useAppConfig: () => ({
      appConfig: {
        galoyInstance: { ...GALOY_INSTANCES[0], esignMintUrl: MINT_ORIGIN },
        token: SESSION_TOKEN,
      },
    }),
  }
})

/** Read through holders so a test can change what the host named or what the price feed
 *  answers, without the screen being rebuilt around it. */
const mockHostFields = { current: HOST_FIELDS as Record<string, string> }
const mockUsdCentsPerBtc = { current: USD_CENTS_PER_BTC as number | null }

jest.mock("@app/config/feature-flags-context", () => {
  const actual = jest.requireActual("@app/config/feature-flags-context")

  return {
    ...actual,
    useRemoteConfig: () => ({
      ...actual.defaultRemoteConfig,
      cardInvestmentAgreementPrefill: mockHostFields.current,
    }),
  }
})

/** The converter is absent until the feed answers, as in the real hook; once it has, it
 *  prices whatever satoshis it is handed at the holder's rate, so the figures below only
 *  come out right when the screen asks for exactly one bitcoin. */
jest.mock("@app/hooks/use-price-conversion", () => {
  const actual = jest.requireActual("@app/hooks/use-price-conversion")
  const priceInCents = (satoshis: number) =>
    Math.round((satoshis * (mockUsdCentsPerBtc.current ?? 0)) / actual.SATS_PER_BTC)

  return {
    ...actual,
    usePriceConversion: () => ({
      convertMoneyAmount:
        mockUsdCentsPerBtc.current === null
          ? undefined
          : ({ amount }: { amount: number }) => ({
              amount: priceInCents(amount),
              currency: "USD",
            }),
    }),
  }
})

/** The call to the service, which is what the screen has instead of a form url: it hands
 *  over the signer and the values and opens whatever the service answers with. */
const mockMintSigningInstance = jest.fn()

jest.mock("@app/screens/card-screen/onboarding/investment-flow/esign-mint", () => ({
  ...jest.requireActual("@app/screens/card-screen/onboarding/investment-flow/esign-mint"),
  mintSigningInstance: (...args: unknown[]) => mockMintSigningInstance(...args),
}))

/** The record the home reads to steer the investor back to paying; its own spec covers
 *  the store, so what matters here is that signing writes it, with what. */
const mockStartCardInvestment = jest.fn()
/** Whether the account the record is filed under is known; a custodial session can
 *  still be asking the server on a cold open. */
const mockIsAccountResolved = { current: true }

jest.mock("@app/hooks/use-card-investment-progress", () => ({
  useCardInvestmentProgress: () => ({
    start: (...args: unknown[]) => mockStartCardInvestment(...args),
    isAccountResolved: mockIsAccountResolved.current,
  }),
}))

/** Read through a getter so a test can arrive on the route with a different choice. */
const mockRouteParams = { current: { selectedAmountUsd: SELECTED_AMOUNT_USD } }

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()
const mockGoBack = jest.fn()

/** The routes a stack reset dispatched, so a test can say where the signer lands. */
const resetRoutes = () => {
  const action = mockDispatch.mock.calls[0]?.[0] as
    | { type?: string; payload?: { index?: number; routes?: unknown[] } }
    | undefined
  expect(action?.type).toBe("RESET")
  return action?.payload
}

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      dispatch: mockDispatch,
      goBack: mockGoBack,
    }),
    useRoute: () => ({ params: mockRouteParams.current }),
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
  checkConnection: jest.fn(),
  /** Mirrors the real hook, where `sign` is rebuilt whenever the source is: a stand-in
   *  that handed back one stable function would hide the double start a rebuilt source
   *  causes. Calls still land on `sign`, so tests count them there. */
  signSource: null as unknown,
  signForSource: (() => {}) as () => void,
}

jest.mock("@blinkbitcoin/esign-react-native/webform", () => {
  /** The source factory and the error copy are the real ones; only the hook is replaced. */
  const actual = jest.requireActual("@blinkbitcoin/esign-react-native/webform")

  return {
    createHostedFormSource: actual.createHostedFormSource,
    getErrorMessage: actual.getErrorMessage,
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

const rerenderScreen = async (rerender: (ui: React.ReactElement) => void) => {
  await act(async () => {
    rerender(
      <ContextForScreen>
        <SignInvestScreen />
      </ContextForScreen>,
    )
  })
}

const startedSession = async (): Promise<{ url: string }> => {
  const source = mockESign.options?.source as {
    start: () => Promise<{ url: string }>
  }
  return source.start()
}

/** What the screen handed the service on its one call. */
const mintRequest = () =>
  mockMintSigningInstance.mock.calls[0][0] as {
    origin: string
    token: string
    recipient: { name: string; email: string }
    prefill: Record<string, { value: string; locked: boolean }>
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
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockHostFields.current = HOST_FIELDS
    mockUsdCentsPerBtc.current = USD_CENTS_PER_BTC
    mockIsAccountResolved.current = true
    mockMintSigningInstance.mockResolvedValue({
      url: TEST_INSTANCE_URL,
      envelopeId: TEST_ENVELOPE_ID,
    })
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()

    expect(toJSON()).toBeTruthy()
  })

  /**
   * The signer already chose to sign on the Term Sheet, so a second gate would ask the
   * same question twice, which is what headless mode buys.
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

  /** Leaving idle clears the guard, so the retry the failure screen offers is not a
   *  button that starts nothing. */
  it("starts again when a retry brings it back to idle", async () => {
    mockESign.status = "error"
    mockESign.error = { code: "PROVIDER_UNAVAILABLE", message: "nope" }

    const { rerender } = await renderScreen()

    expect(mockESign.sign).not.toHaveBeenCalled()

    mockESign.status = "idle"
    mockESign.error = null

    await rerenderScreen(rerender)

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
  })

  /**
   * The wiring, and nothing the agreement module already pins: the mint is made against
   * the instance's service as the session, for the signer the host named, with the
   * host's fields and the figures of the amount the investor chose on the document.
   */
  it("mints the agreement against the service as the session, from the host's fields and the chosen amount", async () => {
    await renderScreen()
    await startedSession()

    expect(mockMintSigningInstance).toHaveBeenCalledTimes(1)
    expect(mintRequest()).toMatchObject({
      origin: MINT_ORIGIN,
      token: SESSION_TOKEN,
      recipient: { name: "Test Signer", email: "signer@example.test" },
      prefill: {
        [AGREEMENT_LABELS.units]: { value: "25000", locked: true },
        [HOST_COUNTRY_LABEL]: { value: "Testland", locked: true },
      },
    })
  })

  /** The agreement is written from the figure the investor picked, so a request that
   *  always asked for the same one would document an investment nobody chose. */
  it("carries a different choice through to the document", async () => {
    mockRouteParams.current = { selectedAmountUsd: 1000 }

    await renderScreen()
    await startedSession()

    expect(mintRequest().prefill[AGREEMENT_LABELS.units]).toEqual({
      value: "1000",
      locked: true,
    })
  })

  it("opens the url the service minted", async () => {
    await renderScreen()

    expect((await startedSession()).url).toBe(TEST_INSTANCE_URL)
  })

  /** The source is what turns a failed mint into the failure state the retry lives on,
   *  so the rejection has to reach it rather than being swallowed here. */
  it("lets a failed mint reach the signing source", async () => {
    mockMintSigningInstance.mockRejectedValue(new Error("no email on the account"))

    await renderScreen()

    await expect(startedSession()).rejects.toThrow("no email on the account")
  })

  /** On a cold open the price feed may not have answered yet, and the agreement cannot be
   *  minted without it: the spinner waits for the price rather than failing the session
   *  it is about to start, and starts as soon as it is in. */
  it("waits for the price before starting the session", async () => {
    mockUsdCentsPerBtc.current = null

    const { rerender, getByTestId } = await renderScreen()

    expect(mockESign.sign).not.toHaveBeenCalled()
    expect(getByTestId("sign-invest-loading")).toBeTruthy()

    mockUsdCentsPerBtc.current = USD_CENTS_PER_BTC
    await rerenderScreen(rerender)

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
  })

  describe("when the price does not come", () => {
    const START_WAIT_TIMEOUT_MS = WAIT_TIMEOUT_MS

    beforeEach(() => {
      jest.useFakeTimers()
      mockUsdCentsPerBtc.current = null
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    const waitOut = async () => {
      await act(async () => {
        jest.advanceTimersByTime(START_WAIT_TIMEOUT_MS)
      })
    }

    /** A spinner with no end and no button is a dead end; a feed silent this long
     *  means the device is most likely offline, which is what the signer is told. */
    it("gives up after a while and says the connection was lost", async () => {
      const { getByText, queryByTestId } = await renderScreen()
      await waitOut()

      expect(getByText(/Connection lost/)).toBeTruthy()
      expect(getByText("Try Again")).toBeTruthy()
      expect(queryByTestId("sign-invest-loading")).toBeNull()
      expect(mockESign.sign).not.toHaveBeenCalled()
    })

    it("waits again, for as long as before, when the signer tries again", async () => {
      const { getByText, getByTestId, queryByText } = await renderScreen()
      await waitOut()

      await act(async () => {
        fireEvent.press(getByText("Try Again"))
      })
      expect(getByTestId("sign-invest-loading")).toBeTruthy()

      await act(async () => {
        jest.advanceTimersByTime(START_WAIT_TIMEOUT_MS - 1)
      })
      expect(queryByText(/Connection lost/)).toBeNull()

      await act(async () => {
        jest.advanceTimersByTime(1)
      })
      expect(getByText(/Connection lost/)).toBeTruthy()
    })

    /** The feed answers on its own once the device is back; the session starts then,
     *  without another tap, whichever screen the signer was looking at. */
    it("starts the session as soon as the price arrives, even after giving up", async () => {
      const { rerender, queryByText } = await renderScreen()
      await waitOut()

      mockUsdCentsPerBtc.current = USD_CENTS_PER_BTC
      await rerenderScreen(rerender)

      expect(mockESign.sign).toHaveBeenCalledTimes(1)
      expect(queryByText(/Connection lost/)).toBeNull()
    })

    it("does not give up once the price has arrived in time", async () => {
      const { rerender, queryByText } = await renderScreen()

      mockUsdCentsPerBtc.current = USD_CENTS_PER_BTC
      await rerenderScreen(rerender)
      await waitOut()

      expect(queryByText(/Connection lost/)).toBeNull()
      expect(mockESign.sign).toHaveBeenCalledTimes(1)
    })

    /** The account is waited for the same way, and its absence ends the same way. */
    it("gives up on the account the same way it gives up on the price", async () => {
      mockUsdCentsPerBtc.current = USD_CENTS_PER_BTC
      mockIsAccountResolved.current = false

      const { getByText } = await renderScreen()
      await waitOut()

      expect(getByText(/Connection lost/)).toBeTruthy()
      expect(mockESign.sign).not.toHaveBeenCalled()
    })
  })

  /** Signing writes the investment against the account; with nowhere to file it the home
   *  would never steer the investor back to paying, so the session waits for the account
   *  the same way it waits for the price. */
  it("waits until the investment can be filed before starting the session", async () => {
    mockIsAccountResolved.current = false

    const { rerender } = await renderScreen()
    expect(mockESign.sign).not.toHaveBeenCalled()

    mockIsAccountResolved.current = true
    rerender(
      <ContextForScreen>
        <SignInvestScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
  })

  /**
   * The price ticks every few seconds. A source rebuilt on each tick would restart the
   * session mid-signature, so the rate is read as the document is minted, which is also
   * the stamped moment the agreement names, and the source stays the same.
   */
  it("reads the price as it mints, without rebuilding the session on every tick", async () => {
    const { rerender } = await renderScreen()
    const firstSource = mockESign.options?.source

    mockUsdCentsPerBtc.current = 20_000_000
    await rerenderScreen(rerender)

    expect(mockESign.options?.source).toBe(firstSource)

    await startedSession()

    expect(mintRequest().prefill[AGREEMENT_LABELS.btcUsdRate]).toEqual({
      value: "200000.00",
      locked: true,
    })
  })

  it("keeps the same source across re-renders so the session is not restarted", async () => {
    const { rerender } = await renderScreen()

    const firstSource = mockESign.options?.source

    await rerenderScreen(rerender)

    expect(mockESign.options?.source).toBe(firstSource)
  })

  it("rebuilds the source when the chosen amount changes", async () => {
    const { rerender } = await renderScreen()

    const firstSource = mockESign.options?.source
    mockRouteParams.current = { selectedAmountUsd: 1000 }

    await rerenderScreen(rerender)

    expect(mockESign.options?.source).not.toBe(firstSource)
  })

  describe("what the signer sees", () => {
    it("shows the form itself once the session is under way", async () => {
      mockESign.status = "signing"
      mockESign.webViewProps = { source: { uri: TEST_INSTANCE_URL } }

      const { getByTestId } = await renderScreen()

      expect(
        getByTestId("sign-invest-webview", { includeHiddenElements: true }),
      ).toBeTruthy()
    })

    /** The signing page asks for the signer's location, which Android's WebView turns
     *  into a system permission prompt on every visit; the signature does not need it. */
    it("does not let the signing page ask for the signer's location", async () => {
      mockESign.status = "signing"
      mockESign.webViewProps = { source: { uri: TEST_INSTANCE_URL } }

      const { getByTestId } = await renderScreen()

      expect(
        getByTestId("sign-invest-webview", { includeHiddenElements: true }).props
          .geolocationEnabled,
      ).toBe(false)
    })

    /** The WebView is hidden from accessibility while covered, and the queries skip
     *  hidden elements unless told otherwise. */
    describe("while the signing page draws", () => {
      const PAGE_READY = JSON.stringify({ type: "blink-signing-page-ready" })
      const PAGE_READY_TIMEOUT_MS = 20_000

      const signing = () => {
        mockESign.status = "signing"
        mockESign.webViewProps = {
          source: { uri: TEST_INSTANCE_URL },
          onMessage: jest.fn(),
          startInLoadingState: true,
        }
      }

      const postFromPage = async (webview: ReactTestInstance, data: string) => {
        await act(async () => {
          webview.props.onMessage({ nativeEvent: { data } })
        })
      }

      afterEach(() => {
        jest.useRealTimers()
      })

      /** The page spins on an indicator of its own for seconds after it has loaded, so
       *  the WebView's own loading state ends too early to stand in for the wait. */
      it("covers the page with the step's own spinner, not the WebView's", async () => {
        signing()

        const { getByTestId } = await renderScreen()
        const webview = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        })

        expect(getByTestId("sign-invest-loading")).toBeTruthy()
        expect(webview.props.startInLoadingState).toBe(false)
        expect(webview.props.injectedJavaScript).toContain("blink-signing-page-ready")
      })

      it("uncovers the page once it reports that it has drawn", async () => {
        signing()

        const { getByTestId, queryByTestId } = await renderScreen()
        await postFromPage(
          getByTestId("sign-invest-webview", { includeHiddenElements: true }),
          PAGE_READY,
        )

        expect(queryByTestId("sign-invest-loading")).toBeNull()
        expect(
          getByTestId("sign-invest-webview", { includeHiddenElements: true }).props
            .accessibilityElementsHidden,
        ).toBe(false)
      })

      /** The report is the step's own signal, not one of the signing outcomes the
       *  library reads; handing it over would have the library warn about it. */
      it("keeps the page's report to itself", async () => {
        signing()

        const { getByTestId } = await renderScreen()
        await postFromPage(
          getByTestId("sign-invest-webview", { includeHiddenElements: true }),
          PAGE_READY,
        )

        expect(mockESign.webViewProps?.onMessage).not.toHaveBeenCalled()
      })

      it("keeps a screen reader off the page while it is covered", async () => {
        signing()

        const { getByTestId } = await renderScreen()
        const webview = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        })

        expect(webview.props.accessibilityElementsHidden).toBe(true)
        expect(webview.props.importantForAccessibility).toBe("no-hide-descendants")
      })

      /** The outcome of the signing reaches the library through the same channel. */
      it("hands every other message to the library untouched", async () => {
        signing()
        const { getByTestId } = await renderScreen()
        const webview = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        })

        await postFromPage(webview, JSON.stringify({ type: "complete" }))
        await postFromPage(webview, "not json")

        expect(mockESign.webViewProps?.onMessage).toHaveBeenCalledTimes(2)
        expect(mockESign.webViewProps?.onMessage).toHaveBeenCalledWith({
          nativeEvent: { data: "not json" },
        })
      })

      it("uncovers the page after a while even if it never reports", async () => {
        jest.useFakeTimers()
        signing()

        const { queryByTestId } = await renderScreen()
        expect(queryByTestId("sign-invest-loading")).toBeTruthy()
        await act(async () => {
          jest.advanceTimersByTime(PAGE_READY_TIMEOUT_MS)
        })

        expect(queryByTestId("sign-invest-loading")).toBeNull()
      })

      /** A session that fails and restarts gets the full wait for its new page: the
       *  clock started for the first page must not uncover the second one early. */
      it("starts the wait over for a restarted session", async () => {
        jest.useFakeTimers()
        signing()
        const { queryByTestId, rerender } = await renderScreen()
        await act(async () => {
          jest.advanceTimersByTime(PAGE_READY_TIMEOUT_MS / 2)
        })

        mockESign.status = "error"
        await rerenderScreen(rerender)
        signing()
        await rerenderScreen(rerender)
        await act(async () => {
          jest.advanceTimersByTime(PAGE_READY_TIMEOUT_MS - 1)
        })
        expect(queryByTestId("sign-invest-loading")).toBeTruthy()

        await act(async () => {
          jest.advanceTimersByTime(1)
        })
        expect(queryByTestId("sign-invest-loading")).toBeNull()
      })

      /** A restarted session draws its page anew, and is covered anew while it does. */
      it("covers a new session's page again", async () => {
        signing()
        const { getByTestId, queryByTestId, rerender } = await renderScreen()
        await postFromPage(
          getByTestId("sign-invest-webview", { includeHiddenElements: true }),
          PAGE_READY,
        )
        expect(queryByTestId("sign-invest-loading")).toBeNull()

        mockESign.status = "loading"
        await rerenderScreen(rerender)
        signing()
        await rerenderScreen(rerender)

        expect(getByTestId("sign-invest-loading")).toBeTruthy()
      })
    })

    it("waits on a spinner while the session is being opened", async () => {
      mockESign.status = "loading"

      const { getByTestId, queryByTestId } = await renderScreen()

      expect(getByTestId("sign-invest-loading")).toBeTruthy()
      expect(
        queryByTestId("sign-invest-webview", { includeHiddenElements: true }),
      ).toBeNull()
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

    /** The library may report the state without a detail; the screen still has to say
     *  something the signer can act on rather than nothing. */
    it("words a failure the library reported without detail", async () => {
      mockESign.status = "error"
      mockESign.error = null

      const { getByText } = await renderScreen()

      expect(getByText("Error")).toBeTruthy()
      expect(getByText("Try Again")).toBeTruthy()
    })

    it("retries a failed session", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "PROVIDER_UNAVAILABLE", message: "nope" }

      const { getByText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByText("Try Again"))
      })

      expect(mockESign.retry).toHaveBeenCalledTimes(1)
    })

    /** The hosted-form source mints a fresh envelope on every start and offers no way to
     *  reopen an old one, so an expired session is retried like any other failure. */
    it("retries an expired session the same way", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "SESSION_EXPIRED", message: "expired" }
      mockESign.isSessionExpired = true

      const { getByText } = await renderScreen()

      await act(async () => {
        fireEvent.press(getByText("Try Again"))
      })

      expect(mockESign.retry).toHaveBeenCalledTimes(1)
    })
  })

  describe("where each outcome leads", () => {
    const callbackOf = (name: string) =>
      mockESign.options?.[name] as (arg?: never) => void

    /**
     * Carries the agreement's own figure forward, which is the whole reason the signing
     * step asks for it: the transfer step bills that, and converting the dollars again at
     * a later price would charge something the signed document does not state. The stack
     * is rebuilt as the home and that step: every screen of the flow left underneath is
     * a way to sign a second agreement, and back belongs on the home.
     */
    it("advances to the transfer step once signed, with nothing of the flow left underneath", async () => {
      await renderScreen()
      await startedSession()

      await act(async () => {
        callbackOf("onComplete")()
      })

      expect(resetRoutes()).toEqual({
        index: 1,
        routes: [
          { name: "Primary" },
          {
            name: "cardOnboardingTransferInvestScreen",
            params: {
              selectedAmountUsd: SELECTED_AMOUNT_USD,
              settlementSats: SETTLEMENT_SATS,
            },
          },
        ],
      })
      expect(mockNavigate).not.toHaveBeenCalled()
      expect(mockGoBack).not.toHaveBeenCalled()
    })

    /** Signing is the commitment worth following up on, so this is the moment the home
     *  starts steering the investor back to the payment, with the same figures the
     *  transfer step is handed. */
    it("records the signed investment as it moves on", async () => {
      await renderScreen()
      await startedSession()
      expect(mockStartCardInvestment).not.toHaveBeenCalled()

      await act(async () => {
        callbackOf("onComplete")()
      })

      expect(mockStartCardInvestment).toHaveBeenCalledTimes(1)
      expect(mockStartCardInvestment).toHaveBeenCalledWith({
        selectedAmountUsd: SELECTED_AMOUNT_USD,
        settlementSats: SETTLEMENT_SATS,
      })
    })

    /** With no figure to carry, the transfer step falls back to its own conversion, so
     *  the investor is still billed rather than sent on with nothing. */
    it("carries no figure when no agreement was minted", async () => {
      await renderScreen()

      await act(async () => {
        callbackOf("onComplete")()
      })

      expect(resetRoutes()?.routes?.[1]).toEqual({
        name: "cardOnboardingTransferInvestScreen",
        params: { selectedAmountUsd: SELECTED_AMOUNT_USD, settlementSats: undefined },
      })
    })

    it("returns to the term sheet when the signer cancels", async () => {
      await renderScreen()

      await act(async () => {
        callbackOf("onCancel")()
      })

      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    /** Declining lands the session back in idle, where the document is opened from; a
     *  signer who just said no must not get a fresh envelope, nor the page again. */
    it("does not open another session after the signer declines", async () => {
      mockESign.status = "signing"
      const { rerender } = await renderScreen()

      await act(async () => {
        callbackOf("onCancel")()
      })
      mockESign.status = "idle"
      await rerenderScreen(rerender)

      expect(mockGoBack).toHaveBeenCalledTimes(1)
      expect(mockESign.sign).not.toHaveBeenCalled()
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
      expect(mockDispatch).not.toHaveBeenCalled()
    })

    /** The one failure the step words itself: whoever fills the host's fields reads, in
     *  their language, that the signer is missing rather than a raw internal sentence. */
    it("says in the app's own words that the signer is not set up", async () => {
      mockESign.status = "error"
      mockESign.error = {
        code: "SIGNER_NOT_CONFIGURED",
        message: "the agreement's signer is not configured",
      }

      const { getByText, queryByText } = await renderScreen()

      expect(
        getByText("Signer not set up yet. Restart the app and try again."),
      ).toBeTruthy()
      expect(queryByText("the agreement's signer is not configured")).toBeNull()
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
