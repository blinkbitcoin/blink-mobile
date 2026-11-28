import { renderHook } from "@testing-library/react-native"

import { useCourierDelivery } from "@app/screens/card-screen/hooks/use-courier-delivery"

let mockCourier = { minDays: 3, maxDays: 7, priceUsd: 0 }

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ replaceCardDeliveryConfig: { courier: mockCourier } }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatCurrency: ({ amountInMajorUnits }: { amountInMajorUnits: number }) =>
      `$${amountInMajorUnits.toFixed(2)}`,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => {
  const { loadLocale } = jest.requireActual("@app/i18n/i18n-util.sync")
  const { i18nObject } = jest.requireActual("@app/i18n/i18n-util")
  loadLocale("en")
  const LL = i18nObject("en")
  return { useI18nContext: () => ({ LL }) }
})

describe("useCourierDelivery", () => {
  afterEach(() => {
    mockCourier = { minDays: 3, maxDays: 7, priceUsd: 0 }
  })

  it("names the courier and its business days from the config", () => {
    const { result } = renderHook(() => useCourierDelivery())

    expect(result.current.title).toBe("Courier delivery")
    expect(result.current.businessDays).toBe("3-7 business days")
  })

  it("ships the first card free", () => {
    mockCourier = { minDays: 3, maxDays: 7, priceUsd: 100 }
    const { result } = renderHook(() => useCourierDelivery())

    expect(result.current.firstCardPrice).toBe("FREE")
  })

  it("prices the replacement as free while the config has no price", () => {
    const { result } = renderHook(() => useCourierDelivery())

    expect(result.current.replacementPrice).toBe("FREE")
    expect(result.current.isReplacementFree).toBe(true)
  })

  it("prices the replacement from the config once it has one", () => {
    mockCourier = { minDays: 2, maxDays: 5, priceUsd: 100 }
    const { result } = renderHook(() => useCourierDelivery())

    expect(result.current.replacementPrice).toBe("$100.00")
    expect(result.current.isReplacementFree).toBe(false)
    expect(result.current.businessDays).toBe("2-5 business days")
  })
})
