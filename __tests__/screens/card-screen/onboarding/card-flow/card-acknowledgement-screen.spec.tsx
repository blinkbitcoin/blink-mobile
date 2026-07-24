import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import InAppBrowser from "react-native-inappbrowser-reborn"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardAcknowledgementScreen } from "@app/screens/card-screen/onboarding/card-flow/card-acknowledgement-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("@rn-vui/themed", () =>
  jest.requireActual("../../../../helpers/card-flow-mocks").mockThemedWithCheckbox(),
)

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
  }
})

jest.mock("react-native-inappbrowser-reborn", () => ({
  open: jest.fn(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    cardESignConsentUrl: "https://example.com/e-sign",
    cardIssuerPrivacyPolicyUrl: "https://example.com/privacy",
    cardCardholderAgreementUrl: "https://example.com/terms",
  }),
}))

const CERTIFY_TEXT =
  "I certify that the information I have provided is accurate and that I will abide by all the rules and requirements related to my Blink Visa Card"
const ACKNOWLEDGE_TEXT =
  "I acknowledge that applying for the Blink Visa Card does not constitute unauthorized solicitation"

describe("CardAcknowledgementScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays the title", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Terms and conditions")).toBeTruthy()
  })

  it("displays all acknowledgement texts and links", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("E-Sign Consent")).toBeTruthy()
    expect(getByText("Issuer's Privacy Policy")).toBeTruthy()
    expect(getByText("Blink Card Terms")).toBeTruthy()
    expect(getByText(CERTIFY_TEXT)).toBeTruthy()
    expect(getByText(ACKNOWLEDGE_TEXT)).toBeTruthy()
  })

  it("keeps the button disabled when no checkbox is checked", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Accept")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  for (const skipIndex of [0, 1, 2, 3]) {
    it(`keeps the button disabled when only checkbox ${skipIndex} is left unchecked`, async () => {
      const { getByText, getAllByTestId } = render(
        <ContextForScreen>
          <CardAcknowledgementScreen />
        </ContextForScreen>,
      )

      await act(async () => {})

      const unchecked = getAllByTestId("checkbox-unchecked")
      await act(async () => {
        unchecked.forEach((checkbox, index) => {
          if (index !== skipIndex) fireEvent.press(checkbox)
        })
      })

      await act(async () => {
        fireEvent.press(getByText("Accept"))
      })

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  }

  it("navigates to the processing screen when all checkboxes are checked", async () => {
    const { getByText, getAllByTestId } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const unchecked = getAllByTestId("checkbox-unchecked")
    await act(async () => {
      unchecked.forEach((checkbox) => fireEvent.press(checkbox))
    })

    const button = getByText("Accept")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingProcessingScreen")
  })

  it("opens the e-sign consent link when pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("E-Sign Consent"))
    })

    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/e-sign")
  })

  it("opens the privacy policy and card terms links when pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Issuer's Privacy Policy"))
      fireEvent.press(getByText("Blink Card Terms"))
    })

    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/privacy")
    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/terms")
  })
})
