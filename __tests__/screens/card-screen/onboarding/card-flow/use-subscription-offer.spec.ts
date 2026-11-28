import { renderHook } from "@testing-library/react-native"

import { useSubscriptionOffer } from "@app/screens/card-screen/onboarding/card-flow/use-subscription-offer"

let mockPriceUsd = 1000

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ cardSubscriptionPriceUsd: mockPriceUsd }),
}))

const mockFormatCurrency = ({ amountInMajorUnits }: { amountInMajorUnits: number }) =>
  `$${amountInMajorUnits.toFixed(2)}`

const mockFormatMoneyAmount = ({
  moneyAmount,
  noFractionDigits,
}: {
  moneyAmount: { amount: number }
  noFractionDigits?: boolean
}) => `$${(moneyAmount.amount / 100).toFixed(noFractionDigits ? 0 : 2)}`

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: mockFormatCurrency,
    formatMoneyAmount: mockFormatMoneyAmount,
  }),
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
    const { result } = renderHook(() => useSubscriptionOffer())

    expect(result.current).toEqual({
      isFree: true,
      title: "Blink Orange",
      price: "Free",
      priceTone: "positive",
      caption: "for now",
      rows: [
        { label: "Blink Card", value: "$0", tone: "default" },
        { label: "Other member benefits", value: "$0", tone: "default" },
      ],
    })
  })

  it("shows the yearly price with the first year free", () => {
    const { result } = renderHook(() => useSubscriptionOffer())

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
})
