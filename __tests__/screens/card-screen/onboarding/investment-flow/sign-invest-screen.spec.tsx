import React from "react"
import * as vm from "vm"
import { Linking, View } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import type { ReactTestInstance } from "react-test-renderer"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { logError } from "@app/utils/log-error"
import {
  AGREEMENT_LABELS,
  ROUTE_MISSING_CODE,
  signingFailure,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-agreement"
import {
  REPORT_PAGE_READY_SCRIPT,
  SignInvestScreen,
} from "@app/screens/card-screen/onboarding/investment-flow/sign-invest-screen"

import { ContextForScreen } from "../../../helper"

/** The amount the user picked two screens earlier, which the agreement is written from. */
const SELECTED_AMOUNT_USD = 25000

/** Where the instance under test says the e-sign service answers, read through a holder
 *  so a test can take it away, and where remote config may say it answers instead. */
const MINT_ORIGIN = "https://esign.example.test"
const mockInstanceMintUrl = { current: MINT_ORIGIN }
const mockRemoteMintUrl = { current: "" }

/** The page the service serves the outcome back through, which is where the library's
 *  messages come from; and the signing page itself, which is DocuSign's. */
const SERVICE_PAGE_URL = `${MINT_ORIGIN}/return`
const SIGNING_PAGE_URL = "https://demo.docusign.net/Signing/StartInSession.aspx"

jest.mock("@app/config/feature-flags-context", () => {
  const actual = jest.requireActual("@app/config/feature-flags-context")
  return {
    ...actual,
    useRemoteConfig: () => ({
      ...actual.defaultRemoteConfig,
      cardInvestmentEsignMintUrl: mockRemoteMintUrl.current,
    }),
  }
})

/** Restored after each use: the flag is global. The restore is a closure made before
 *  the flag is touched, so nothing is written from stale state after the wait. */
const devFlag = globalThis as unknown as { __DEV__: boolean }
const setDevFlag = (isDev: boolean): (() => void) => {
  const wasDev = devFlag.__DEV__
  devFlag.__DEV__ = isDev
  return () => {
    devFlag.__DEV__ = wasDev
  }
}
const withDevFlag = async (isDev: boolean, run: () => Promise<void>) => {
  const restore = setDevFlag(isDev)
  try {
    await run()
  } finally {
    restore()
  }
}

/** The session the service verifies before it mints. */
const SESSION_TOKEN = "session-token"

/** A round rate the figures can be checked against by hand, in the cents the price feed
 *  is read in: $100,000 per bitcoin, so $25,000 settles at a quarter of a bitcoin. */
const USD_CENTS_PER_BTC = 10_000_000
const SETTLEMENT_SATS = 25_000_000

/** What the service answers with: the envelope's signing url and its id. */
const TEST_INSTANCE_URL = "https://sign.example.test/envelope/1"
const TEST_ENVELOPE_ID = "11111111-2222-3333-4444-555555555555"

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

/** The instance names the service, and the session is what the mint is made as. */
jest.mock("@app/hooks/use-app-config", () => {
  const { GALOY_INSTANCES } = jest.requireActual("@app/config")

  return {
    useAppConfig: () => ({
      appConfig: {
        galoyInstance: {
          ...GALOY_INSTANCES[0],
          esignMintUrl: mockInstanceMintUrl.current,
        },
        token: SESSION_TOKEN,
      },
    }),
  }
})

/** Read through a holder so a test can change what the price feed answers, without the
 *  screen being rebuilt around it. */
const mockUsdCentsPerBtc = { current: USD_CENTS_PER_BTC as number | null }

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
 *  over the values and opens whatever the service answers with. */
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

/** Moves the stand-in to a status, as the library does between renders. */
const settleTo = (status: SigningStatus) => {
  mockESign.status = status
}

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
    prefill: Record<string, { value: string; locked: boolean }>
  }

/** Every stand-in back to its opening state. */
const resetScreenMocks = () => {
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
  mockUsdCentsPerBtc.current = USD_CENTS_PER_BTC
  mockInstanceMintUrl.current = MINT_ORIGIN
  mockRemoteMintUrl.current = ""
  mockIsAccountResolved.current = true
  mockMintSigningInstance.mockResolvedValue({
    url: TEST_INSTANCE_URL,
    envelopeId: TEST_ENVELOPE_ID,
  })
}

describe("SignInvestScreen", () => {
  beforeEach(resetScreenMocks)

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
   * the instance's service as the session, with the figures of the amount the investor
   * chose and no signer, since the service asks its host who signs.
   */
  it("mints the agreement against the service as the session, from the chosen amount alone", async () => {
    await renderScreen()
    await startedSession()

    expect(mockMintSigningInstance).toHaveBeenCalledTimes(1)
    expect(mintRequest()).toMatchObject({
      origin: MINT_ORIGIN,
      token: SESSION_TOKEN,
      prefill: { [AGREEMENT_LABELS.units]: { value: "25000", locked: true } },
    })
    expect(mintRequest()).not.toHaveProperty("recipient")
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
    const START_WAIT_TIMEOUT_MS = 15_000

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

      const postFromPage = async (
        webview: ReactTestInstance,
        data: string,
        url: string = SERVICE_PAGE_URL,
      ) => {
        await act(async () => {
          webview.props.onMessage({ nativeEvent: { data, url } })
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
          nativeEvent: { data: "not json", url: SERVICE_PAGE_URL },
        })
      })

      /** A WebView message names the page it came from. Only the page the service
       *  serves may drive the signing: a page reached through a link inside the
       *  document could otherwise post a completion nobody signed. */
      it("drops a signing message from a page the service does not serve", async () => {
        signing()
        const { getByTestId } = await renderScreen()
        const webview = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        })

        await postFromPage(
          webview,
          JSON.stringify({ event: "signing_complete" }),
          "https://evil.example.test/complete",
        )
        await postFromPage(webview, JSON.stringify({ event: "signing_complete" }), "")

        expect(mockESign.webViewProps?.onMessage).not.toHaveBeenCalled()
        expect(logError).toHaveBeenCalledWith(
          expect.objectContaining({
            scope: "card-investment-esign",
            context: { url: "https://evil.example.test/complete" },
          }),
        )
        expect(logError).not.toHaveBeenCalledWith(
          expect.objectContaining({ expected: true }),
        )
      })

      /** A message with no page named cannot be from the service; it is dropped, not
       *  thrown on. */
      it("drops a signing message that names no page", async () => {
        signing()
        const { getByTestId } = await renderScreen()
        const webview = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        })

        await act(async () => {
          webview.props.onMessage({
            nativeEvent: { data: JSON.stringify({ event: "signing_complete" }) },
          })
        })

        expect(mockESign.webViewProps?.onMessage).not.toHaveBeenCalled()
        expect(logError).toHaveBeenCalledWith(
          expect.objectContaining({ context: { url: "" } }),
        )
      })

      /** Remote config may move the service while a session is open; the session's
       *  messages are checked against the service that minted it, not the new one. */
      it("checks messages against the service the session was minted at", async () => {
        const { rerender, getByTestId } = await renderScreen()
        await startedSession()
        mockRemoteMintUrl.current = "https://esign-moved.blink.sv"
        signing()
        await rerenderScreen(rerender)
        const webview = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        })

        await postFromPage(webview, JSON.stringify({ event: "cancel" }), SERVICE_PAGE_URL)
        await postFromPage(
          webview,
          JSON.stringify({ event: "cancel" }),
          "https://esign-moved.blink.sv/return",
        )

        expect(mockESign.webViewProps?.onMessage).toHaveBeenCalledTimes(1)
        expect(mockESign.webViewProps?.onMessage).toHaveBeenCalledWith({
          nativeEvent: {
            data: JSON.stringify({ event: "cancel" }),
            url: SERVICE_PAGE_URL,
          },
        })
      })

      /** The service's origin is compared as an origin, not as a string. */
      it("takes a signing message from the service's page whatever its case or path", async () => {
        signing()
        const { getByTestId } = await renderScreen()
        const webview = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        })

        await postFromPage(
          webview,
          JSON.stringify({ event: "cancel" }),
          "HTTPS://ESIGN.EXAMPLE.TEST/return?event=cancel#x",
        )

        expect(mockESign.webViewProps?.onMessage).toHaveBeenCalledTimes(1)
      })

      /** The report is posted by whichever page is drawing, DocuSign's included; it only
       *  uncovers the page, so it needs no such check. */
      it("reads the page's report from whichever page draws it", async () => {
        signing()
        const { getByTestId, queryByTestId } = await renderScreen()

        await postFromPage(
          getByTestId("sign-invest-webview", { includeHiddenElements: true }),
          PAGE_READY,
          SIGNING_PAGE_URL,
        )

        expect(queryByTestId("sign-invest-loading")).toBeNull()
      })

      /** A link inside the document belongs in the browser: opened there, it never takes
       *  the signing page's place in this WebView. */
      it("keeps the WebView to the signing's own pages and opens anything else outside", async () => {
        const openUrl = jest.spyOn(Linking, "openURL").mockResolvedValue(true)
        signing()
        const { getByTestId } = await renderScreen()
        const shouldLoad = getByTestId("sign-invest-webview", {
          includeHiddenElements: true,
        }).props.onShouldStartLoadWithRequest as (request: {
          url: string
          isTopFrame?: boolean
        }) => boolean

        expect(shouldLoad({ url: SIGNING_PAGE_URL })).toBe(true)
        expect(shouldLoad({ url: "https://account-d.docusign.com/oauth" })).toBe(true)
        expect(shouldLoad({ url: SERVICE_PAGE_URL })).toBe(true)
        expect(shouldLoad({ url: "about:blank" })).toBe(true)
        expect(Linking.openURL).not.toHaveBeenCalled()

        expect(shouldLoad({ url: "https://www.blink.sv/terms" })).toBe(false)
        expect(shouldLoad({ url: "https://docusign.net.evil.example/x" })).toBe(false)
        expect(shouldLoad({ url: "https://docusign.net:x@evil.example/x" })).toBe(false)
        expect(shouldLoad({ url: "https://evil.example\\.docusign.net/x" })).toBe(false)
        expect(shouldLoad({ url: "mailto:support@blink.sv" })).toBe(false)
        /** The frames the page loads inside are its own business; iOS asks about
         *  those too, and blocking one would open it over the signing. */
        expect(
          shouldLoad({ url: "https://cdn.example.test/captcha", isTopFrame: false }),
        ).toBe(true)
        /** A page the phone cannot open is neither loaded nor handed to the phone. */
        expect(shouldLoad({ url: "about:srcdoc" })).toBe(false)
        expect(shouldLoad({ url: "blob:https://demo.docusign.net/abc" })).toBe(false)
        expect(Linking.openURL).not.toHaveBeenCalledWith("about:srcdoc")
        expect(Linking.openURL).not.toHaveBeenCalledWith(
          "blob:https://demo.docusign.net/abc",
        )
        expect(Linking.openURL).not.toHaveBeenCalledWith(
          "https://cdn.example.test/captcha",
        )

        /** A phone with nothing to open the link with is not a failure of the signing. */
        openUrl.mockRejectedValueOnce(new Error("no handler"))
        expect(shouldLoad({ url: "tel:+50400000000" })).toBe(false)
        await act(async () => {})
        expect(Linking.openURL).toHaveBeenCalledWith("https://www.blink.sv/terms")
        expect(Linking.openURL).toHaveBeenCalledWith(
          "https://docusign.net.evil.example/x",
        )
        expect(Linking.openURL).toHaveBeenCalledWith("mailto:support@blink.sv")
        openUrl.mockRestore()
      })

      /** The page is hidden from a screen reader while covered, so the cover has to be
       *  what it reads instead: a spinner that says what it is, in a view that holds
       *  the reader on it rather than on the close button and silence. */
      it("gives a screen reader the cover to read while the page is hidden", async () => {
        signing()
        const screen = await renderScreen()

        const spinner = screen.getByTestId("sign-invest-loading")
        expect(spinner.props.accessibilityRole).toBe("progressbar")
        expect(spinner.props.accessibilityLabel).toBe("Preparing your agreement.")
        const cover = screen
          .UNSAFE_getAllByType(View)
          .find(({ props }) => props.accessibilityViewIsModal === true)
        expect(cover).toBeTruthy()
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

    /** The library's copy is English only; the app words every code it knows itself,
     *  so the failure reads in the signer's language like the rest of the step. */
    it("words a failure with the app's own copy for its code", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "PROVIDER_UNAVAILABLE", message: "nope" }

      const { getByText, queryByText } = await renderScreen()

      expect(getByText("Error")).toBeTruthy()
      expect(getByText(/The signing service is temporarily unavailable/)).toBeTruthy()
      expect(queryByText(/^Signing service temporarily unavailable/)).toBeNull()
    })

    /** A refusal carries the service's reason, worded for the signer already. */
    it("shows the service's own reason for a refusal", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "VALIDATION_ERROR", message: "No investor on file." }

      const { getByText } = await renderScreen()

      expect(getByText("No investor on file.")).toBeTruthy()
    })

    it("words a code it does not know with the general copy", async () => {
      mockESign.status = "error"
      mockESign.error = { code: "SOMETHING_NEW", message: "nope" }

      const { getByText } = await renderScreen()

      expect(getByText(/Something went wrong/)).toBeTruthy()
    })

    /** A route the service does not serve is not cured by tapping again, so no button. */
    it("offers no retry when the service does not serve the mint", async () => {
      mockESign.status = "error"
      mockESign.error = { code: ROUTE_MISSING_CODE, message: "HTTP 404" }

      const { getByText, queryByText } = await renderScreen()

      expect(getByText(/not available on this server/)).toBeTruthy()
      expect(queryByText("Try Again")).toBeNull()
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
})

describe("SignInvestScreen, where it mints", () => {
  beforeEach(resetScreenMocks)

  /**
   * `sign` is rebuilt whenever the source is; the effect that opens the session runs
   * again then, and without the guard would open a second session on top of the first
   * while the status is still idle. The most expensive mistake on this screen is a
   * double mint, so this is the one that has to be pinned.
   */
  it("opens one session, not two, when the source is rebuilt while still idle", async () => {
    const { rerender } = await renderScreen()
    expect(mockESign.sign).toHaveBeenCalledTimes(1)

    mockRouteParams.current = { selectedAmountUsd: 50000 }
    await rerenderScreen(rerender)

    expect(mockESign.sign).toHaveBeenCalledTimes(1)
  })

  /** Remote config names the service first, so the endpoint can be switched or withdrawn
   *  without a release; the instance's own value stands until it does. */
  it("mints at the origin remote config names over the instance's", async () => {
    mockRemoteMintUrl.current = "https://esign-remote.blink.sv"
    await renderScreen()

    await startedSession()

    expect(mintRequest().origin).toBe("https://esign-remote.blink.sv")
  })

  /** The mint carries the session token, so a release build follows the remote value
   *  only onto Blink's own hosts; anything else is ignored and the instance's stands. */
  it("keeps to the instance's origin when remote config names a host that is not Blink's", async () => {
    mockRemoteMintUrl.current = "https://esign.evil.example"

    await withDevFlag(false, async () => {
      await renderScreen()
      await startedSession()

      expect(mintRequest().origin).toBe(MINT_ORIGIN)
    })
  })

  /** A build with nowhere to mint says so, with no retry that cannot win, and opens no
   *  session: the instance names no service, remote config none either, and a release
   *  build has no developer's machine to fall back to. */
  it("says signing is not available when this build has nowhere to mint", async () => {
    mockInstanceMintUrl.current = ""

    await withDevFlag(false, async () => {
      const { getByText, queryByText } = await renderScreen()

      expect(getByText(/Signing is not available yet/)).toBeTruthy()
      expect(queryByText("Try Again")).toBeNull()
      expect(mockESign.sign).not.toHaveBeenCalled()
    })
  })
})

describe("SignInvestScreen, where each outcome leads", () => {
  beforeEach(resetScreenMocks)

  const callbackOf = (name: string) =>
    mockESign.options?.[name] as (arg?: unknown) => void

  /** What the library hands over once the session it opened completes. */
  const signed = (envelopeId?: string) => ({ envelopeId, status: "completed" })

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
      callbackOf("onComplete")(signed(TEST_ENVELOPE_ID))
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
      callbackOf("onComplete")(signed(TEST_ENVELOPE_ID))
    })

    expect(mockStartCardInvestment).toHaveBeenCalledTimes(1)
    expect(mockStartCardInvestment).toHaveBeenCalledWith({
      selectedAmountUsd: SELECTED_AMOUNT_USD,
      settlementSats: SETTLEMENT_SATS,
    })
  })

  /** The library names no envelope for a session minted without an id; the figure
   *  minted last is still the one the document names. */
  it("carries the figure when the library names no envelope", async () => {
    mockMintSigningInstance.mockResolvedValue({ url: TEST_INSTANCE_URL })
    await renderScreen()
    await startedSession()

    await act(async () => {
      callbackOf("onComplete")(signed(undefined))
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
  })

  /**
   * The transfer step bills the figure minted with the document that was signed. A
   * session that completes on another envelope than the one minted last would put one
   * document's figure under another's signature, so the step stops and says so.
   */
  it("stops when the signed envelope is not the one it minted last", async () => {
    const { getByText, queryByText } = await renderScreen()
    await startedSession()

    await act(async () => {
      callbackOf("onComplete")(signed("some-other-envelope"))
    })

    expect(mockDispatch).not.toHaveBeenCalled()
    expect(getByText(/not the one this step prepared/)).toBeTruthy()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { signed: "some-other-envelope", minted: TEST_ENVELOPE_ID },
      }),
    )

    await act(async () => {
      fireEvent.press(getByText("Try Again"))
    })

    expect(mockESign.retry).toHaveBeenCalledTimes(1)
    expect(queryByText(/not the one this step prepared/)).toBeNull()
  })

  /** Once settled, the library lands back in idle, where a session would open on its
   *  own; while the step is saying another envelope was signed, it must not. */
  it("opens no session on its own while it says another envelope was signed", async () => {
    const { getByText, rerender } = await renderScreen()
    await startedSession()
    expect(mockESign.sign).toHaveBeenCalledTimes(1)

    await act(async () => {
      callbackOf("onComplete")(signed("some-other-envelope"))
    })
    settleTo("success")
    await rerenderScreen(rerender)
    settleTo("idle")
    await rerenderScreen(rerender)
    expect(mockESign.sign).toHaveBeenCalledTimes(1)

    await act(async () => {
      fireEvent.press(getByText("Try Again"))
    })

    expect(mockESign.sign).toHaveBeenCalledTimes(2)
  })

  /**
   * The library gives up on a mint after a while but cannot stop it. One that lands
   * after the signer has moved on to a fresh mint must not put the older price's
   * figure under the newer document, which is the one the signer sees and signs.
   */
  it("keeps the figure of the latest mint when an abandoned one lands late", async () => {
    const { rerender } = await renderScreen()
    let finishFirstMint: (minted: unknown) => void = () => {}
    mockMintSigningInstance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishFirstMint = resolve
        }),
    )
    const firstMint = startedSession()

    /** The price moves before the second mint reads it: $125,000 per bitcoin, so the
     *  same $25,000 settles at a fifth of a bitcoin. */
    mockUsdCentsPerBtc.current = 12_500_000
    await rerenderScreen(rerender)
    let finishSecondMint: (minted: unknown) => void = () => {}
    mockMintSigningInstance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishSecondMint = resolve
        }),
    )
    const secondMint = startedSession()

    await act(async () => {
      finishSecondMint({ url: TEST_INSTANCE_URL, envelopeId: "envelope-2" })
      await secondMint
    })
    await act(async () => {
      finishFirstMint({ url: TEST_INSTANCE_URL, envelopeId: "envelope-1" })
      await firstMint
    })
    await act(async () => {
      callbackOf("onComplete")(signed("envelope-2"))
    })

    expect(resetRoutes()).toEqual({
      index: 1,
      routes: [
        { name: "Primary" },
        {
          name: "cardOnboardingTransferInvestScreen",
          params: {
            selectedAmountUsd: SELECTED_AMOUNT_USD,
            settlementSats: 20_000_000,
          },
        },
      ],
    })
  })

  /** With no figure to carry, the transfer step falls back to its own conversion, so
   *  the investor is still billed rather than sent on with nothing. */
  it("carries no figure when no agreement was minted", async () => {
    await renderScreen()

    await act(async () => {
      callbackOf("onComplete")(signed(TEST_ENVELOPE_ID))
    })

    expect(resetRoutes()).toEqual({
      index: 1,
      routes: [
        { name: "Primary" },
        {
          name: "cardOnboardingTransferInvestScreen",
          params: {
            selectedAmountUsd: SELECTED_AMOUNT_USD,
            settlementSats: undefined,
          },
        },
      ],
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

  /** The error goes to the log as it came, stack and identity included, with its
   *  code beside it; no status, since no service answered this one. */
  it("reports the failure as it came, with its error code", async () => {
    await renderScreen()
    const failure = { code: "ENVELOPE_CREATION_FAILED", message: "nope" }

    await act(async () => {
      callbackOf("onError")(failure)
    })

    expect(logError).toHaveBeenCalledWith({
      scope: "card-investment-esign",
      error: failure,
      context: { code: "ENVELOPE_CREATION_FAILED", status: undefined },
    })
  })

  /** The library hands the screen a failure's code and message alone; the status the
   *  service answered is kept on the way through, for the log to name. */
  it("names the status the service answered a failed mint with", async () => {
    await renderScreen()
    mockMintSigningInstance.mockRejectedValueOnce(signingFailure("HTTP 502", 502))
    await expect(startedSession()).rejects.toMatchObject({ message: "HTTP 502" })

    await act(async () => {
      callbackOf("onError")({ code: "ENVELOPE_CREATION_FAILED", message: "HTTP 502" })
    })

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { code: "ENVELOPE_CREATION_FAILED", status: 502 },
      }),
    )
  })
})

/**
 * The script the WebView runs inside the signing page, run here the way a page would run
 * it: no test renders a real WebView, so this is the only place it executes at all.
 */
describe("REPORT_PAGE_READY_SCRIPT", () => {
  const PAGE_READY_POLL_LIMIT = 80

  const runInPage = (innerText: string) => {
    const ticks: Array<() => void> = []
    const page = {
      document: { body: { innerText } },
      window: { ReactNativeWebView: { postMessage: jest.fn() } },
      setInterval: jest.fn((tick: () => void) => {
        ticks.push(tick)
        return 7
      }),
      clearInterval: jest.fn(),
    }
    const result = vm.runInNewContext(REPORT_PAGE_READY_SCRIPT, page)
    return { page, result, tick: () => ticks[0]() }
  }

  it("evaluates to true, as a WebView's injected script must", () => {
    expect(runInPage("").result).toBe(true)
  })

  it("posts the report once the page has visible text, and stops looking", () => {
    const { page, tick } = runInPage("Please review the documents")

    tick()

    expect(page.window.ReactNativeWebView.postMessage).toHaveBeenCalledWith(
      JSON.stringify({ type: "blink-signing-page-ready" }),
    )
    expect(page.clearInterval).toHaveBeenCalledWith(7)
  })

  it("keeps looking while the page is blank", () => {
    const { page, tick } = runInPage("   ")

    tick()
    tick()

    expect(page.window.ReactNativeWebView.postMessage).not.toHaveBeenCalled()
    expect(page.clearInterval).not.toHaveBeenCalled()
  })

  it("reports a page that draws later", () => {
    const { page, tick } = runInPage("")

    tick()
    page.document.body.innerText = "Sign here"
    tick()

    expect(page.window.ReactNativeWebView.postMessage).toHaveBeenCalledTimes(1)
  })

  /** A page that never draws is uncovered by the step's own timeout; the script gives
   *  up at the same moment rather than measure a page shown long ago. */
  it("gives up without a report once the step would have uncovered the page", () => {
    const { page, tick } = runInPage("")

    for (let look = 0; look < PAGE_READY_POLL_LIMIT; look += 1) tick()

    expect(page.clearInterval).toHaveBeenCalledWith(7)
    expect(page.window.ReactNativeWebView.postMessage).not.toHaveBeenCalled()
  })
})
