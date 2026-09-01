import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { logError } from "@app/utils/log-error"
import { SignInvestScreen } from "@app/screens/card-screen/onboarding/investment-flow/sign-invest-screen"

import { ContextForScreen } from "../../../helper"

const TEST_FORM_URL = "https://forms.example.test/investment-agreement"
const TEST_ALLOWED_ORIGIN = "https://apps.example.test"

jest.mock("@app/utils/log-error", () => ({
  logError: jest.fn(),
}))

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
  }
})

jest.mock("@app/config", () => {
  const actual = jest.requireActual("@app/config")
  return {
    ...actual,
    ESIGN_INVESTMENT_FORM_URL: "https://forms.example.test/investment-agreement",
    ESIGN_ALLOWED_ORIGIN: "https://apps.example.test",
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
  })

  it("renders without crashing", async () => {
    const { toJSON } = await renderScreen()

    expect(toJSON()).toBeTruthy()
  })

  it("labels the signing step with the localized copy", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Sign the agreement")).toBeTruthy()
  })

  it("builds the source from the configured form url and origin", async () => {
    await renderScreen()

    const source = mockLastProps.current?.source as {
      start: () => Promise<{ url: string; allowedOrigin?: string }>
    }
    const session = await source.start()

    expect(session.url).toBe(TEST_FORM_URL)
    expect(session.allowedOrigin).toBe(TEST_ALLOWED_ORIGIN)
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

  it("advances to the transfer step once the agreement is signed", async () => {
    const { getByTestId } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByTestId("esign-complete"))
    })

    expect(mockReplace).toHaveBeenCalledWith("cardOnboardingTransferInvestScreen")
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
