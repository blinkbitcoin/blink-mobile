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

const mockDispatch = jest.fn()
const mockSubmitApplication = jest.fn()
const mockToastShow = jest.fn()
const mockSubmitState = { isSubmitting: false }

const ANSWERS = {
  occupation: "15-1132",
  annualSalary: "50,000 - 74,999",
  accountPurpose: "Personal spending",
  expectedMonthlyVolume: "1,000 - 1,999",
}

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      dispatch: mockDispatch,
    }),
    useRoute: () => ({ params: ANSWERS }),
  }
})

jest.mock(
  "@app/screens/card-screen/onboarding/card-flow/use-card-application-submit",
  () => ({
    useCardApplicationSubmit: () => ({
      submitApplication: mockSubmitApplication,
      ...mockSubmitState,
    }),
  }),
)

jest.mock("@app/utils/toast", () => ({
  toastShow: (params: unknown) => mockToastShow(params),
}))

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
  "I certify that the information I have provided is accurate and that I will abide by all the rules and requirements related to my Blink Card"
const ACKNOWLEDGE_TEXT =
  "I acknowledge that applying for the Blink Card does not constitute unauthorized solicitation"

describe("CardAcknowledgementScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockSubmitState.isSubmitting = false
    mockSubmitApplication.mockResolvedValue("application-1")
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
    expect(getByText("Issuer’s Privacy Policy")).toBeTruthy()
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

    expect(mockSubmitApplication).not.toHaveBeenCalled()
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

      expect(mockSubmitApplication).not.toHaveBeenCalled()
    })
  }

  const acceptAll = async () => {
    const screen = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    const unchecked = screen.getAllByTestId("checkbox-unchecked")
    await act(async () => {
      unchecked.forEach((checkbox) => fireEvent.press(checkbox))
    })
    await act(async () => {
      fireEvent.press(screen.getByText("Accept"))
    })
    return screen
  }

  it("sends the additional data with the application once every box is checked", async () => {
    await acceptAll()

    expect(mockSubmitApplication).toHaveBeenCalledWith(ANSWERS)
  })

  it("waits for the approval with only Home behind it once the application is sent", async () => {
    await acceptAll()

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "RESET",
        payload: expect.objectContaining({
          index: 1,
          routes: [
            { name: "Primary" },
            {
              name: "cardOnboardingProcessingScreen",
              params: { applicationId: "application-1" },
            },
          ],
        }),
      }),
    )
  })

  it("stays on the terms and says so when the application could not be sent", async () => {
    mockSubmitApplication.mockResolvedValue(null)

    await acceptAll()

    expect(mockDispatch).not.toHaveBeenCalled()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Unexpected error occurred" }),
    )
  })

  it("sends the application once when Accept is tapped twice in the same frame", async () => {
    let finishSending: (applicationId: string) => void = () => {}
    mockSubmitApplication.mockReturnValue(
      new Promise<string>((resolve) => {
        finishSending = resolve
      }),
    )
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

    await act(async () => {
      fireEvent.press(getByText("Accept"))
      fireEvent.press(getByText("Accept"))
    })
    await act(async () => {
      finishSending("application-1")
    })

    expect(mockSubmitApplication).toHaveBeenCalledTimes(1)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("lets the user try again after a failed send", async () => {
    mockSubmitApplication.mockResolvedValueOnce(null)
    const { getByText } = await acceptAll()

    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockSubmitApplication).toHaveBeenCalledTimes(2)
    expect(mockDispatch).toHaveBeenCalledTimes(1)
  })

  it("holds Accept on its spinner while the application is being sent", async () => {
    mockSubmitState.isSubmitting = true
    const { queryByText } = render(
      <ContextForScreen>
        <CardAcknowledgementScreen />
      </ContextForScreen>,
    )
    await act(async () => {})

    expect(queryByText("Accept")).toBeNull()
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
      fireEvent.press(getByText("Issuer’s Privacy Policy"))
      fireEvent.press(getByText("Blink Card Terms"))
    })

    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/privacy")
    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/terms")
  })
})
