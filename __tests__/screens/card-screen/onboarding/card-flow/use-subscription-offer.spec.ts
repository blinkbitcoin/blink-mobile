import { renderHook } from "@testing-library/react-native"

import { useSubscriptionOffer } from "@app/screens/card-screen/onboarding/card-flow/use-subscription-offer"

let mockPriceUsd = 1000

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ cardSubscriptionPriceUsd: mockPriceUsd }),
}))

const mockFormatCurrency = ({ amountInMajorUnits }: { amountInMajorUnits: number }) =>
  `$${amountInMajorUnits.toFixed(2)}`

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatCurrency: mockFormatCurrency }),
}))

jest.mock("@app/i18n/i18n-react", () => {
  const { loadLocale } = jest.requireActual("@app/i18n/i18n-util.sync")
  const { i18nObject } = jest.requireActual("@app/i18n/i18n-util")
  loadLocale("en")
  const LL = i18nObject("en")
  return { useI18nContext: () => ({ LL, locale: "en" }) }
})

describe("useSubscriptionOffer", () => {
  afterEach(() => {
    mockPriceUsd = 1000
  })

  it("offers the membership for free when the price is zero", () => {
    mockPriceUsd = 0
    const { result } = renderHook(() =>
      useSubscriptionOffer({ isSubscribeVariant: true }),
    )

    expect(result.current).toEqual({
      isFree: true,
      title: "Blink Orange",
      price: "Free",
      priceTone: "positive",
      caption: "for now",
      rows: [
        { label: "Blink Card", value: "$0.00", tone: "default" },
        { label: "Other member benefits", value: "$0.00", tone: "default" },
      ],
    })
  })

  it("shows the yearly price with the first year free while subscribing", () => {
    const { result } = renderHook(() =>
      useSubscriptionOffer({ isSubscribeVariant: true }),
    )

    expect(result.current).toMatchObject({
      isFree: false,
      title: "Blink Orange",
      price: "$1000.00",
      priceTone: "accent",
      caption: "per year",
    })
    expect(result.current.rows[0]).toEqual({
      label: "Special offer",
      value: "First year free",
      tone: "positive",
    })
    expect(result.current.rows[1]).toMatchObject({
      label: "Renewal date",
      tone: "default",
    })
  })

  it("shows the payment as pending on the payment step", () => {
    const { result } = renderHook(() =>
      useSubscriptionOffer({ isSubscribeVariant: false }),
    )

    expect(result.current.rows[0]).toEqual({
      label: "Status",
      value: "Payment Pending",
      tone: "accent",
    })
  })
})
