import React from "react"
import { render, fireEvent, act, waitFor } from "@testing-library/react-native"
import type { ReactTestInstance } from "react-test-renderer"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { logError } from "@app/utils/log-error"
import {
  signingFailure,
  signingRouteMissing,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-agreement"
import { SignInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/sign-invest-screen"

import { ContextForScreen } from "../../../helper"

/**
 * The screen on the library's real state machine: the unit spec stands the hook in with
 * the app's own model of it, so every behaviour that rests on library semantics, where
 * a decline lands, what a retry clears, that offline is not an error, is anchored here
 * against the library itself, with only the network stubbed.
 */

const SELECTED_AMOUNT_USD = 25000
const MINT_ORIGIN = "https://esign.example.test"
const SERVICE_PAGE_URL = `${MINT_ORIGIN}/return`
const USD_CENTS_PER_BTC = 10_000_000
const SETTLEMENT_SATS = 25_000_000
const TEST_INSTANCE_URL = "https://sign.example.test/envelope/1"
const TEST_ENVELOPE_ID = "11111111-2222-3333-4444-555555555555"

/** The library holds its success state this long before it reports completion. */
const SUCCESS_DELAY_MS = 1500

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

jest.mock("@app/hooks/use-app-config", () => {
  const { GALOY_INSTANCES } = jest.requireActual("@app/config")
  return {
    useAppConfig: () => ({
      appConfig: {
        galoyInstance: { ...GALOY_INSTANCES[0], esignMintUrl: MINT_ORIGIN },
        token: "session-token",
      },
    }),
  }
})

jest.mock("@app/hooks/use-price-conversion", () => {
  const actual = jest.requireActual("@app/hooks/use-price-conversion")
  return {
    ...actual,
    usePriceConversion: () => ({
      convertMoneyAmount: ({ amount }: { amount: number }) => ({
        amount: Math.round((amount * USD_CENTS_PER_BTC) / actual.SATS_PER_BTC),
        currency: "USD",
      }),
    }),
  }
})

/** The one network call: the service's mint. */
const mockMintSigningInstance = jest.fn()
jest.mock("@app/screens/card-screen/onboarding/investment-flow/esign-mint", () => ({
  ...jest.requireActual("@app/screens/card-screen/onboarding/investment-flow/esign-mint"),
  mintSigningInstance: (...args: unknown[]) => mockMintSigningInstance(...args),
}))

/** The device's connectivity, which the library probes before every start. */
const mockIsConnected = { current: true }
jest.mock("@react-native-community/netinfo", () => {
  const fetch = () =>
    Promise.resolve({ isConnected: mockIsConnected.current, isInternetReachable: true })
  return { fetch, addEventListener: () => () => {}, default: { fetch } }
})

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()
const mockGoBack = jest.fn()
jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      dispatch: mockDispatch,
      goBack: mockGoBack,
    }),
    useRoute: () => ({ params: { selectedAmountUsd: SELECTED_AMOUNT_USD } }),
  }
})

const renderScreen = () =>
  render(
    <ContextForScreen>
      <SignInvestScreen />
    </ContextForScreen>,
  )

/** The session has started once the library shows the page it minted. */
const signingPage = async (utils: ReturnType<typeof renderScreen>) => {
  await waitFor(() =>
    expect(
      utils.getByTestId("sign-invest-webview", { includeHiddenElements: true }),
    ).toBeTruthy(),
  )
  return utils.getByTestId("sign-invest-webview", { includeHiddenElements: true })
}

/** What the service's return page posts into the WebView for each outcome. */
const postOutcome = async (page: ReactTestInstance, event: string) => {
  await act(async () => {
    page.props.onMessage({
      nativeEvent: { data: JSON.stringify({ event }), url: SERVICE_PAGE_URL },
    })
  })
}

describe("SignInvestScreen on the library's own state machine", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockIsConnected.current = true
    mockMintSigningInstance.mockResolvedValue({
      url: TEST_INSTANCE_URL,
      envelopeId: TEST_ENVELOPE_ID,
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("mints as it opens and shows the page the service minted", async () => {
    const utils = renderScreen()

    const page = await signingPage(utils)

    expect(mockMintSigningInstance).toHaveBeenCalledTimes(1)
    expect(mockMintSigningInstance.mock.calls[0][0]).toMatchObject({
      origin: MINT_ORIGIN,
      token: "session-token",
    })
    expect(page.props.source).toEqual({ uri: TEST_INSTANCE_URL })
  })

  /** The library holds its success state, then reports the envelope it completed; the
   *  step moves on with the figure minted for that envelope. */
  it("advances to the transfer step with the minted figure once the page reports the signature", async () => {
    jest.useFakeTimers()
    const utils = renderScreen()
    const page = await signingPage(utils)

    await postOutcome(page, "signing_complete")
    expect(mockDispatch).not.toHaveBeenCalled()
    await act(async () => {
      jest.advanceTimersByTime(SUCCESS_DELAY_MS)
    })

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
                selectedAmountUsd: SELECTED_AMOUNT_USD,
                settlementSats: SETTLEMENT_SATS,
              },
            },
          ],
        },
      }),
    )
  })

  /** A page reached through a link inside the document posts a completion nobody
   *  signed; the library never hears it, so nothing completes and nothing moves on. */
  it("ignores a completion posted by a page the service does not serve", async () => {
    jest.useFakeTimers()
    const utils = renderScreen()
    const page = await signingPage(utils)

    await act(async () => {
      page.props.onMessage({
        nativeEvent: {
          data: JSON.stringify({ event: "signing_complete" }),
          url: "https://evil.example.test/complete",
        },
      })
    })
    await act(async () => {
      jest.advanceTimersByTime(SUCCESS_DELAY_MS)
    })

    expect(mockDispatch).not.toHaveBeenCalled()
    expect(
      utils.getByTestId("sign-invest-webview", { includeHiddenElements: true }),
    ).toBeTruthy()
  })

  /** A decline lands the library back in idle and calls the cancel callback; the step
   *  goes back and, crucially, does not mint a fresh envelope from idle. */
  it("returns to the term sheet on a decline without minting again", async () => {
    const utils = renderScreen()
    const page = await signingPage(utils)

    await postOutcome(page, "decline")
    await act(async () => {})

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockMintSigningInstance).toHaveBeenCalledTimes(1)
  })

  it("returns to the term sheet when the signer cancels on the page", async () => {
    const utils = renderScreen()
    const page = await signingPage(utils)

    await postOutcome(page, "cancel")
    await act(async () => {})

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  /** A failed mint is an error state with a retry; the retry clears it, lands in idle,
   *  and the step opens a session again on its own. */
  it("retries a failed mint from the failure screen", async () => {
    mockMintSigningInstance.mockRejectedValueOnce(signingFailure("HTTP 502", 502))
    const { findByText, getByText } = renderScreen()

    expect(await findByText(/could not be prepared/)).toBeTruthy()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { code: "ENVELOPE_CREATION_FAILED", status: 502 },
      }),
    )

    await act(async () => {
      fireEvent.press(getByText("Try Again"))
    })

    await waitFor(() => expect(mockMintSigningInstance).toHaveBeenCalledTimes(2))
  })

  /** A route the service does not serve is a deployment behind the app, not something
   *  a tap cures: its own copy, no retry, and the status in the log. */
  it("says the server does not serve signing yet, with no retry", async () => {
    mockMintSigningInstance.mockRejectedValue(signingRouteMissing("HTTP 404", 404))
    const { findByText, queryByText } = renderScreen()

    expect(await findByText(/not available on this server/)).toBeTruthy()
    expect(queryByText("Try Again")).toBeNull()
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: { code: "MINT_ROUTE_MISSING", status: 404 } }),
    )
    expect(mockMintSigningInstance).toHaveBeenCalledTimes(1)
  })

  /** Offline is a state of its own in the library, not an error: nothing is minted,
   *  nothing is logged as a failure, and checking the connection once it is back starts
   *  the session without another tap. */
  it("waits offline without minting, and starts once the connection is back", async () => {
    mockIsConnected.current = false
    const { findByText, getByText } = renderScreen()

    expect(await findByText(/Connection lost/)).toBeTruthy()
    expect(mockMintSigningInstance).not.toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()

    mockIsConnected.current = true
    await act(async () => {
      fireEvent.press(getByText("Try Again"))
    })

    await waitFor(() => expect(mockMintSigningInstance).toHaveBeenCalledTimes(1))
  })

  it("stays offline when the connection is still gone", async () => {
    mockIsConnected.current = false
    const { findByText, getByText } = renderScreen()
    await findByText(/Connection lost/)

    await act(async () => {
      fireEvent.press(getByText("Try Again"))
    })
    await act(async () => {})

    expect(getByText(/Connection lost/)).toBeTruthy()
    expect(mockMintSigningInstance).not.toHaveBeenCalled()
  })
})
