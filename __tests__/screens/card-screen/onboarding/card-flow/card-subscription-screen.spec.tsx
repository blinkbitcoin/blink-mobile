import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import InAppBrowser from "react-native-inappbrowser-reborn"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardSubscriptionScreen } from "@app/screens/card-screen/onboarding/card-flow/card-subscription-screen"
import { ContextForScreen } from "../../../helper"

jest.mock("@rn-vui/themed", () =>
  jest.requireActual("../../../../helpers/card-flow-mocks").mockThemedWithCheckbox(),
)

const mockNavigate = jest.fn()
const mockSetOptions = jest.fn()
const mockUseRoute = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      setOptions: mockSetOptions,
    }),
    useRoute: () => mockUseRoute(),
  }
})

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  WalletCurrency: { Usd: "USD" },
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  open: jest.fn(),
}))

let mockPriceUsd = 1000

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({
    cardTermsAndConditionsUrl: "https://example.com/terms",
    cardPrivacyPolicyUrl: "https://example.com/privacy",
    cardCardholderAgreementUrl: "https://example.com/cardholder",
    cardSubscriptionPriceUsd: mockPriceUsd,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: ({ amountInMajorUnits }: { amountInMajorUnits: number }) =>
      `$${amountInMajorUnits.toFixed(2)}`,
  }),
}))

/** "TODO: payment flow" is what the payment step logs on press; captured so the expected
 *  log does not reach the CI output. */
let consoleLogSpy: jest.SpyInstance

beforeEach(() => {
  consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  consoleLogSpy.mockRestore()
  mockPriceUsd = 1000
})

const NOTICE_CHECKBOX_INDEX = 0
const FEE_SCHEDULE_CHECKBOX_INDEX = 1

const renderScreen = async () => {
  const screen = render(
    <ContextForScreen>
      <CardSubscriptionScreen />
    </ContextForScreen>,
  )
  await act(async () => {})
  return screen
}

const checkBoxes = async (
  getAllByTestId: (id: string) => ReturnType<typeof render>["root"][],
  indexes: number[],
) => {
  const unchecked = getAllByTestId("checkbox-unchecked")
  await act(async () => {
    indexes.forEach((index) => fireEvent.press(unchecked[index]))
  })
}

describe("CardSubscriptionScreen - free offer", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockPriceUsd = 0
    mockUseRoute.mockReturnValue({ name: "cardOnboardingSubscribeScreen" })
  })

  it("shows the membership as free for now, with nothing to pay", async () => {
    const { getByText, getAllByText } = await renderScreen()

    expect(getByText("Free")).toBeTruthy()
    expect(getByText("for now")).toBeTruthy()
    expect(getByText("Blink Card")).toBeTruthy()
    expect(getByText("Other member benefits")).toBeTruthy()
    expect(getAllByText("$0.00")).toHaveLength(2)
  })

  it("asks to acknowledge that a fee may come later", async () => {
    const { getByText } = await renderScreen()

    expect(
      getByText(
        "I understand Blink Orange is free for now, and that a membership fee may be introduced later, with notice",
      ),
    ).toBeTruthy()
  })

  it("leaves the header without a title", async () => {
    await renderScreen()

    expect(mockSetOptions).toHaveBeenCalledWith({ title: "" })
  })

  it("opens the identity check once both checkboxes are accepted", async () => {
    const { getByText, getAllByTestId } = await renderScreen()

    await checkBoxes(getAllByTestId, [NOTICE_CHECKBOX_INDEX, FEE_SCHEDULE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })
})

describe("CardSubscriptionScreen - paid offer", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({ name: "cardOnboardingSubscribeScreen" })
  })

  it("shows the yearly price with the first year free", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Blink Orange")).toBeTruthy()
    expect(getByText("$1000.00")).toBeTruthy()
    expect(getByText("per year")).toBeTruthy()
    expect(getByText("Special offer")).toBeTruthy()
    expect(getByText("First year free")).toBeTruthy()
  })

  it("titles the header Subscribe", async () => {
    await renderScreen()

    expect(mockSetOptions).toHaveBeenCalledWith({ title: "Subscribe" })
  })

  it("displays renew checkbox text", async () => {
    const { getByText } = await renderScreen()

    expect(
      getByText("I understand my subscription will automatically renew in 12 months"),
    ).toBeTruthy()
  })

  /** The terms moved to the acknowledgement step at the end of the flow. */
  it("leaves the terms out of this step", async () => {
    const { queryByText, getAllByTestId } = await renderScreen()

    expect(queryByText("Terms of Service")).toBeNull()
    expect(getAllByTestId("checkbox-unchecked")).toHaveLength(2)
  })

  it("navigates to the fee schedule screen when the link is pressed", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Blink Card Fee Schedule"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardFeeScheduleScreen")
  })

  it("button is disabled when no checkbox is checked", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("keeps the button disabled when only the renew checkbox is checked", async () => {
    const { getByText, getAllByTestId } = await renderScreen()

    await checkBoxes(getAllByTestId, [NOTICE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("keeps the button disabled when only the fee schedule checkbox is checked", async () => {
    const { getByText, getAllByTestId } = await renderScreen()

    await checkBoxes(getAllByTestId, [FEE_SCHEDULE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("opens the identity check once renewal and fee schedule are accepted", async () => {
    const { getByText, getAllByTestId } = await renderScreen()

    await checkBoxes(getAllByTestId, [NOTICE_CHECKBOX_INDEX, FEE_SCHEDULE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("unchecks a checkbox when pressed again", async () => {
    const { getByText, getAllByTestId, getByTestId } = await renderScreen()

    await checkBoxes(getAllByTestId, [NOTICE_CHECKBOX_INDEX, FEE_SCHEDULE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getAllByTestId("checkbox-checked")[NOTICE_CHECKBOX_INDEX])
    })
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(getByTestId("checkbox-unchecked")).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })
})

describe("CardSubscriptionScreen - payment variant", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({ name: "cardOnboardingPaymentScreen" })
  })

  it("displays payment pending status", async () => {
    const { getByText } = await renderScreen()

    expect(getByText("Status")).toBeTruthy()
    expect(getByText("Payment Pending")).toBeTruthy()
  })

  it("keeps the header title the navigator gives it", async () => {
    await renderScreen()

    expect(mockSetOptions).not.toHaveBeenCalled()
  })

  it("does not display renew checkbox", async () => {
    const { queryByText } = await renderScreen()

    expect(
      queryByText("I understand my subscription will automatically renew in 12 months"),
    ).toBeNull()
  })

  it("logs the pending payment flow instead of opening the identity check", async () => {
    const { getByText, getByTestId } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByTestId("checkbox-unchecked"))
    })
    await act(async () => {
      fireEvent.press(getByText("Continue & Pay"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
    expect(consoleLogSpy).toHaveBeenCalledWith("TODO: payment flow")
  })

  it("opens the agreement links when pressed", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Terms of Service"))
      fireEvent.press(getByText("Privacy Policy"))
      fireEvent.press(getByText("Cardholder Agreement"))
    })

    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/terms")
    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/privacy")
    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/cardholder")
  })
})
