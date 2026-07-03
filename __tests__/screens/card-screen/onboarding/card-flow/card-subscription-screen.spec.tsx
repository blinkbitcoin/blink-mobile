import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import InAppBrowser from "react-native-inappbrowser-reborn"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardSubscriptionScreen } from "@app/screens/card-screen/onboarding/card-flow/card-subscription-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@react-native-community/blur", () => ({
  BlurView: "BlurView",
}))

jest.mock("react-native-linear-gradient", () => ({
  LinearGradient: "LinearGradient",
}))

jest.mock("@rn-vui/themed", () => {
  const actual = jest.requireActual("@rn-vui/themed")
  const { TouchableOpacity } = jest.requireActual("react-native")
  return {
    ...actual,
    CheckBox: ({
      checked,
      onPress,
      containerStyle,
    }: {
      checked: boolean
      onPress: () => void
      containerStyle: Record<string, number>
      iconType: string
      checkedIcon: string
      uncheckedIcon: string
    }) => (
      <TouchableOpacity
        testID={`checkbox-${checked ? "checked" : "unchecked"}`}
        onPress={onPress}
        style={containerStyle}
      />
    ),
  }
})

const mockNavigate = jest.fn()
const mockUseRoute = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
    }),
    useRoute: () => mockUseRoute(),
  }
})

const mockStartKyc = jest.fn()

jest.mock("@app/hooks", () => ({
  useKycFlow: () => ({ startKyc: mockStartKyc }),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  KycFlowType: { Card: "Card" },
  WalletCurrency: { Usd: "USD" },
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  open: jest.fn(),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    cardTermsAndConditionsUrl: "https://example.com/terms",
    cardPrivacyPolicyUrl: "https://example.com/privacy",
    cardCardholderAgreementUrl: "https://example.com/cardholder",
    cardFeeScheduleUrl: "https://example.com/fee-schedule",
    cardSubscriptionPriceUsd: 1000,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: () => "$1,000",
  }),
}))

// Some app handlers log placeholder/diagnostic messages via console.log when
// pressed (e.g. "TODO: payment flow" in card-subscription-screen); capture them so expected logs don't pollute CI logs.
let consoleLogSpy: jest.SpyInstance

beforeEach(() => {
  consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  consoleLogSpy.mockRestore()
})

describe("CardSubscriptionScreen - subscribe variant", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({ name: "cardOnboardingSubscribeScreen" })
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays first year free status", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("First year free")).toBeTruthy()
  })

  it("displays the special offer label", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Special offer")).toBeTruthy()
  })

  it("displays renew checkbox text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText("I understand my subscription will automatically renew in 12 months"),
    ).toBeTruthy()
  })

  it("displays the fee schedule checkbox text and link", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(/I have reviewed and agree to the/)).toBeTruthy()
    expect(getByText("Blink Card Fee Schedule")).toBeTruthy()
  })

  it("opens the fee schedule link when pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Blink Card Fee Schedule"))
    })

    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/fee-schedule")
  })

  it("keeps the button disabled when only the renew checkbox is checked", async () => {
    const { getByText, getAllByTestId } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const uncheckedBoxes = getAllByTestId("checkbox-unchecked")
    await act(async () => {
      fireEvent.press(uncheckedBoxes[0])
    })

    const button = getByText("Accept")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockStartKyc).not.toHaveBeenCalled()
  })

  it("displays accept button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Accept")).toBeTruthy()
  })

  it("button is disabled when no checkbox is checked", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const button = getByText("Accept")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockStartKyc).not.toHaveBeenCalled()
  })

  it("button is enabled when both checkboxes are checked", async () => {
    const { getByText, getAllByTestId } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const uncheckedBoxes = getAllByTestId("checkbox-unchecked")

    await act(async () => {
      fireEvent.press(uncheckedBoxes[0])
    })

    await act(async () => {
      fireEvent.press(uncheckedBoxes[1])
    })

    expect(getByText("Accept")).toBeTruthy()
  })

  it("calls startKyc when accept pressed with both checkboxes checked", async () => {
    const { getByText, getAllByTestId } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const uncheckedBoxes = getAllByTestId("checkbox-unchecked")

    await act(async () => {
      fireEvent.press(uncheckedBoxes[0])
    })

    await act(async () => {
      fireEvent.press(uncheckedBoxes[1])
    })

    const button = getByText("Accept")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockStartKyc).toHaveBeenCalled()
  })
})

describe("CardSubscriptionScreen - payment variant", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({ name: "cardOnboardingPaymentScreen" })
  })

  it("renders without crashing", async () => {
    const { toJSON } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(toJSON()).toBeTruthy()
  })

  it("displays payment pending status", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Payment Pending")).toBeTruthy()
  })

  it("displays the status label", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Status")).toBeTruthy()
  })

  it("does not display renew checkbox", async () => {
    const { queryByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      queryByText("I understand my subscription will automatically renew in 12 months"),
    ).toBeNull()
  })

  it("displays continue and pay button", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText("Continue & Pay")).toBeTruthy()
  })

  it("does not call startKyc in payment variant", async () => {
    const { getByText, getByTestId } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const agreementCheckbox = getByTestId("checkbox-unchecked")

    await act(async () => {
      fireEvent.press(agreementCheckbox)
    })

    const button = getByText("Continue & Pay")
    await act(async () => {
      fireEvent.press(button)
    })

    expect(mockStartKyc).not.toHaveBeenCalled()
  })

  it("opens the agreement links when pressed", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText("Terms of Service"))
      fireEvent.press(getByText("Privacy Policy"))
      fireEvent.press(getByText("Cardholder Agreement"))
    })

    expect(InAppBrowser.open).toHaveBeenCalledTimes(3)
  })
})
