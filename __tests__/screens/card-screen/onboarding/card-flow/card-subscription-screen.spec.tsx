import React from "react"
import { render, fireEvent, act, within } from "@testing-library/react-native"
import InAppBrowser from "react-native-inappbrowser-reborn"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { CardSubscriptionScreen } from "@app/screens/card-screen/onboarding/card-flow/card-subscription-screen"
import { ContextForScreen } from "../../../helper"

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
    formatMoneyAmount: ({
      moneyAmount,
      noFractionDigits,
    }: {
      moneyAmount: { amount: number }
      noFractionDigits?: boolean
    }) => `$${(moneyAmount.amount / 100).toFixed(noFractionDigits ? 0 : 2)}`,
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
  getAllByRole: ReturnType<typeof render>["getAllByRole"],
  indexes: number[],
) => {
  const unchecked = getAllByRole("checkbox", { checked: false })
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
    expect(getAllByText("$0")).toHaveLength(2)
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
    const { getByText, getAllByRole } = await renderScreen()

    await checkBoxes(getAllByRole, [NOTICE_CHECKBOX_INDEX, FEE_SCHEDULE_CHECKBOX_INDEX])
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
    const { queryByText, getAllByRole } = await renderScreen()

    expect(queryByText("Terms of Service")).toBeNull()
    expect(getAllByRole("checkbox", { checked: false })).toHaveLength(2)
  })

  /** A screen reader reaches what the box sits inside of as one element, so the link has
   *  to stand beside the box to be read and opened on its own. */
  it("opens the fee schedule from a link of its own, without ticking its box", async () => {
    const feeScheduleBox = {
      name: "I have reviewed and agree to the Blink Card Fee Schedule",
    }
    const { getByRole } = await renderScreen()

    expect(within(getByRole("checkbox", feeScheduleBox)).queryByRole("link")).toBeNull()

    await act(async () => {
      fireEvent.press(getByRole("link", { name: "Blink Card Fee Schedule" }))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardFeeScheduleScreen")
    expect(getByRole("checkbox", { ...feeScheduleBox, checked: false })).toBeTruthy()
  })

  it("button is disabled when no checkbox is checked", async () => {
    const { getByText } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("keeps the button disabled when only the renew checkbox is checked", async () => {
    const { getByText, getAllByRole } = await renderScreen()

    await checkBoxes(getAllByRole, [NOTICE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("keeps the button disabled when only the fee schedule checkbox is checked", async () => {
    const { getByText, getAllByRole } = await renderScreen()

    await checkBoxes(getAllByRole, [FEE_SCHEDULE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("opens the identity check once renewal and fee schedule are accepted", async () => {
    const { getByText, getAllByRole } = await renderScreen()

    await checkBoxes(getAllByRole, [NOTICE_CHECKBOX_INDEX, FEE_SCHEDULE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })

  it("unchecks a checkbox when pressed again", async () => {
    const { getByText, getAllByRole, getByRole } = await renderScreen()

    await checkBoxes(getAllByRole, [NOTICE_CHECKBOX_INDEX, FEE_SCHEDULE_CHECKBOX_INDEX])
    await act(async () => {
      fireEvent.press(getAllByRole("checkbox", { checked: true })[NOTICE_CHECKBOX_INDEX])
    })
    await act(async () => {
      fireEvent.press(getByText("Accept"))
    })

    expect(getByRole("checkbox", { checked: false })).toBeTruthy()
    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
  })
})

describe("CardSubscriptionScreen - price change while mounted", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    mockUseRoute.mockReturnValue({ name: "cardOnboardingSubscribeScreen" })
  })

  const changePrice = async (
    rerender: ReturnType<typeof render>["rerender"],
    priceUsd: number,
  ) => {
    mockPriceUsd = priceUsd
    await act(async () => {
      rerender(
        <ContextForScreen>
          <CardSubscriptionScreen />
        </ContextForScreen>,
      )
    })
  }

  const priceChanges = [
    { from: "free", to: "paid", fromPriceUsd: 0, toPriceUsd: 1000 },
    { from: "paid", to: "free", fromPriceUsd: 1000, toPriceUsd: 0 },
  ]

  priceChanges.forEach(({ from, to, fromPriceUsd, toPriceUsd }) => {
    it(`asks again for the notice when the offer turns from ${from} to ${to}`, async () => {
      mockPriceUsd = fromPriceUsd
      const { getByText, getAllByRole, getByRole, rerender } = await renderScreen()

      await checkBoxes(getAllByRole, [NOTICE_CHECKBOX_INDEX, FEE_SCHEDULE_CHECKBOX_INDEX])
      await changePrice(rerender, toPriceUsd)
      await act(async () => {
        fireEvent.press(getByText("Accept"))
      })

      expect(getAllByRole("checkbox", { checked: false })).toHaveLength(1)
      expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")

      await act(async () => {
        fireEvent.press(getByRole("checkbox", { checked: false }))
      })
      await act(async () => {
        fireEvent.press(getByText("Accept"))
      })

      expect(mockNavigate).toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
    })
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
    const { getByText, getByRole } = await renderScreen()

    await act(async () => {
      fireEvent.press(getByRole("checkbox", { checked: false }))
    })
    await act(async () => {
      fireEvent.press(getByText("Continue & Pay"))
    })

    expect(mockNavigate).not.toHaveBeenCalledWith("cardOnboardingVerifyIdentityScreen")
    expect(consoleLogSpy).toHaveBeenCalledWith("TODO: payment flow")
  })

  it("opens each agreement from a link of its own, without ticking the box", async () => {
    const agreementBox = {
      name: "I agree to the Terms of Service, Privacy Policy, and Cardholder Agreement",
    }
    const { getByRole } = await renderScreen()

    expect(within(getByRole("checkbox", agreementBox)).queryByRole("link")).toBeNull()

    await act(async () => {
      fireEvent.press(getByRole("link", { name: "Terms of Service" }))
      fireEvent.press(getByRole("link", { name: "Privacy Policy" }))
      fireEvent.press(getByRole("link", { name: "Cardholder Agreement" }))
    })

    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/terms")
    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/privacy")
    expect(InAppBrowser.open).toHaveBeenCalledWith("https://example.com/cardholder")
    expect(getByRole("checkbox", { ...agreementBox, checked: false })).toBeTruthy()
  })
})
