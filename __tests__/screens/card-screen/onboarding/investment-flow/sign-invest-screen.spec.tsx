import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { logError } from "@app/utils/log-error"
import { SignInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/sign-invest-screen"

import { ContextForScreen } from "../../../helper"

/** The amount the user picked two screens earlier, which the agreement is written from. */
const SELECTED_AMOUNT_USD = 25000

/** What the backend answers with: the form's own address, carrying the short-lived
 *  token that ties it to the instance it just minted. */
const TEST_INSTANCE_URL = "https://forms.example.test/instance#instanceToken=abc"

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

/**
 * The backend that mints the instance, which is what the screen has instead of a form
 * url: the figures are computed and locked on its side, so the app hands it the amount
 * and opens whatever it answers with.
 */
const mockMintOrigin = "http://mint.example.test"
const mockMintSigningInstance = jest.fn()

/** Both are reached through a wrapper rather than handed over directly: the factory is
 *  hoisted above the declarations above, so naming them here would read them before
 *  they exist. */
jest.mock("@app/screens/card-screen/onboarding/investment-flow/esign-mint", () => ({
  resolveMintOrigin: (configured: string) => configured || mockMintOrigin,
  mintSigningInstance: (...args: unknown[]) => mockMintSigningInstance(...args),
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
    createWebFormsSource: core.createWebFormsSource,
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
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockMintSigningInstance.mockResolvedValue({
      url: TEST_INSTANCE_URL,
      envelopeId: "instance-1",
    })
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

  /**
   * The user already chose the amount two screens back, so the mint must be told which
   * one: the figures the agreement locks are computed from it, and asking the form again
   * would let a signed document state an investment nobody picked.
   */
  it("mints the instance for the amount the user chose", async () => {
    await renderScreen()
    await startedSession()

    expect(mockMintSigningInstance).toHaveBeenCalledWith(
      mockMintOrigin,
      SELECTED_AMOUNT_USD,
    )
  })

  /** The agreement is written from the figure the investor picked, so a mint that always
   *  asked for the same one would document an investment nobody chose. */
  it("carries a different choice through to the mint", async () => {
    mockRouteParams.current = { selectedAmountUsd: 1000 }

    await renderScreen()
    await startedSession()

    expect(mockMintSigningInstance).toHaveBeenCalledWith(mockMintOrigin, 1000)
  })

  /**
   * Where to call and how much: that is the whole request. Who the subscriber is stays
   * theirs to answer, and the rate, the settlement and the stamp are the server's to
   * decide - the app sending its own copy is what would let the signed document and the
   * term sheet disagree.
   */
  it("sends the amount and nothing about the signer", async () => {
    await renderScreen()
    await startedSession()

    expect(mockMintSigningInstance).toHaveBeenCalledTimes(1)
    expect(mockMintSigningInstance.mock.calls[0]).toEqual([
      mockMintOrigin,
      SELECTED_AMOUNT_USD,
    ])
  })

  it("opens the form the mint answered with", async () => {
    await renderScreen()

    expect((await startedSession()).url).toBe(TEST_INSTANCE_URL)
  })

  /** The page that posts the signing outcome back is the bridge the mint serves, not
   *  DocuSign's own host, so that is the origin the session expects it from. */
  it("expects the signing events from the mint's own origin", async () => {
    await renderScreen()

    expect((await startedSession()).allowedOrigin).toBe(mockMintOrigin)
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

  it("rebuilds the source when the chosen amount changes", async () => {
    const { rerender } = await renderScreen()

    const firstSource = mockESign.options?.source
    mockRouteParams.current = { selectedAmountUsd: 1000 }

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockESign.options?.source).not.toBe(firstSource)
  })

  describe("what the signer sees", () => {
    it("shows the form itself once the session is under way", async () => {
      mockESign.status = "signing"
      mockESign.webViewProps = { source: { uri: TEST_INSTANCE_URL } }

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
