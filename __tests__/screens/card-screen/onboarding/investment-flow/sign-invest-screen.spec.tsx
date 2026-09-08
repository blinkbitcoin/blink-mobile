import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { light } from "@app/rne-theme/colors"
import { logError } from "@app/utils/log-error"
import { SignInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/sign-invest-screen"

import { ContextForScreen } from "../../../helper"

const TEST_FORM_URL = "https://forms.example.test/investment-agreement"
/** The amount the user picked two screens earlier, which the agreement is written from. */
const SELECTED_AMOUNT_USD = 25000
const TEST_ALLOWED_ORIGIN = "https://apps.example.test"

/** The real palette, so a renamed or dropped colour fails here rather than shipping the
 *  library's own defaults. ContextForScreen renders in the light theme. */
const palette = light

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

/** Read through a getter so a test can render the screen with no form published. */
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

/**
 * Stands in for the library's own component, which owns the signing UI and is
 * tested in its own repo. What matters here is the contract between the screen
 * and it: the source it is handed, and where each callback navigates. The three
 * buttons stand in for the outcomes the real component reports.
 */
const mockLastProps: { current: Record<string, unknown> | null } = { current: null }

jest.mock("@blinkbitcoin/esign-react-native/webform", () => {
  // The source factory is the real one, taken from the platform-agnostic core so
  // that swapping the component never drags the WebView (and its native module)
  // into the test. Only the UI below is a stand-in.
  const { createPublicUrlSource } = jest.requireActual("@blinkbitcoin/esign-core/webform")
  const react = jest.requireActual("react")
  const { Pressable, Text, View } = jest.requireActual("react-native")

  return {
    createPublicUrlSource,
    ESignature: (props: {
      label?: string
      onComplete: (result: { status: string }) => void
      onCancel: () => void
      onError: (error: { code: string; message: string }) => void
    }) => {
      mockLastProps.current = props

      return react.createElement(View, null, [
        react.createElement(Text, { key: "label" }, props.label),
        react.createElement(
          Pressable,
          {
            key: "complete",
            testID: "esign-complete",
            onPress: () => props.onComplete({ status: "completed" }),
          },
          react.createElement(Text, null, "complete"),
        ),
        react.createElement(
          Pressable,
          {
            key: "cancel",
            testID: "esign-cancel",
            onPress: () => props.onCancel(),
          },
          react.createElement(Text, null, "cancel"),
        ),
        react.createElement(
          Pressable,
          {
            key: "error",
            testID: "esign-error",
            onPress: () =>
              props.onError({ code: "ENVELOPE_CREATION_FAILED", message: "nope" }),
          },
          react.createElement(Text, null, "error"),
        ),
      ])
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

describe("SignInvestScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockLastProps.current = null
    mockFormUrl.current = TEST_FORM_URL
    mockRouteParams.current = { selectedAmountUsd: SELECTED_AMOUNT_USD }
    mockUsdPerSat.current = "0.00100000"
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()

    expect(toJSON()).toBeTruthy()
  })

  it("labels the signing step with the localized copy", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Sign the agreement")).toBeTruthy()
  })

  /** DocuSign reads prefilled values off the fragment, not the query string. */
  const prefillOf = (url: string): URLSearchParams =>
    new URLSearchParams(new URL(url).hash.slice(1))

  const startedSession = async (): Promise<{ url: string; allowedOrigin?: string }> => {
    const source = mockLastProps.current?.source as {
      start: () => Promise<{ url: string; allowedOrigin?: string }>
    }
    return source.start()
  }

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

    const firstSource = mockLastProps.current?.source
    const firstPrefill = prefillOf((await startedSession()).url)

    mockUsdPerSat.current = "0.00200000"

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockLastProps.current?.source).toBe(firstSource)
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

    const firstSource = mockLastProps.current?.source

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockLastProps.current?.source).toBe(firstSource)
  })

  it("rebuilds the source when a different form is published", async () => {
    const { rerender } = await renderScreen()

    const firstSource = mockLastProps.current?.source
    mockFormUrl.current = "https://forms.example.test/second-agreement"

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockLastProps.current?.source).not.toBe(firstSource)
    expect(
      (await startedSession()).url.startsWith(
        "https://forms.example.test/second-agreement",
      ),
    ).toBe(true)
  })

  it("advances to the transfer step once the agreement is signed", async () => {
    const { getByTestId } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByTestId("esign-complete"))
    })

    expect(mockReplace).toHaveBeenCalledWith("cardOnboardingTransferInvestScreen", {
      selectedAmountUsd: SELECTED_AMOUNT_USD,
    })
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockGoBack).not.toHaveBeenCalled()
  })

  it("returns to the term sheet when the signer cancels", async () => {
    const { getByTestId } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByTestId("esign-cancel"))
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("stays on the step when signing fails so the retry stays reachable", async () => {
    const { getByTestId } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByTestId("esign-error"))
    })

    expect(mockGoBack).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  /** The component ships its own palette, which would read as another app's inside this
   *  flow. Every colour it exposes is answered from the theme, so none is left behind. */
  it("dresses the component in the app's colours", async () => {
    await renderScreen()

    expect(mockLastProps.current?.theme).toEqual({
      primaryColor: palette.primary,
      primaryTextColor: palette.white,
      mutedTextColor: palette.grey1,
      successColor: palette._green,
      errorColor: palette.error,
      warningColor: palette.warning,
    })
  })

  /** The titles carry no colour of their own, so without this they fall back to the
   *  platform's black and disappear on a dark background. */
  it("gives the titles a colour that follows the theme", async () => {
    await renderScreen()

    const esignStyles = mockLastProps.current?.styles as { title: { color: string } }

    expect(esignStyles.title.color).toBe(palette.black)
  })

  /** A new object on every render would restart the signing session, the same reason the
   *  source is memoized. */
  it("keeps the same theme and styles across re-renders", async () => {
    const { rerender } = await renderScreen()

    const firstTheme = mockLastProps.current?.theme
    const firstStyles = mockLastProps.current?.styles

    await act(async () => {
      rerender(
        <ContextForScreen>
          <SignInvestScreen />
        </ContextForScreen>,
      )
    })

    expect(mockLastProps.current?.theme).toBe(firstTheme)
    expect(mockLastProps.current?.styles).toBe(firstStyles)
  })

  it("reports the failure with its error code", async () => {
    const { getByTestId } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByTestId("esign-error"))
    })

    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "card-investment-esign",
        context: { code: "ENVELOPE_CREATION_FAILED" },
      }),
    )
  })
})
