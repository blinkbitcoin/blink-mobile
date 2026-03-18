import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
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
    cardSubscriptionPriceUsd: 1000,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: () => "$1,000",
  }),
}))

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

  it("displays renew checkbox text", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText("I understand that my subscription will automatically renew in 1 year"),
    ).toBeTruthy()
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

  it("button is disabled when agreement is not checked", async () => {
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

  it("does not display renew checkbox", async () => {
    const { queryByText } = render(
      <ContextForScreen>
        <CardSubscriptionScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      queryByText("I understand that my subscription will automatically renew in 1 year"),
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
})
