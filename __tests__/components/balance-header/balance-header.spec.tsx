import React from "react"
import { fireEvent, render, within } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { BalanceMode } from "@app/hooks/use-balance-mode"

import { BalanceHeader } from "@app/components/balance-header/balance-header"

const mockToggleHideAmount = jest.fn()
let mockHideAmount = false

jest.mock("@app/graphql/hide-amount-context", () => ({
  useHideAmount: () => ({
    hideAmount: mockHideAmount,
    toggleHideAmount: mockToggleHideAmount,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      StableBalance: {
        balanceLabelBtc: () => "Balance · SATS",
        balanceLabelUsd: () => "Balance · USD",
      },
      SelfCustodialStaleRate: {
        notice: () => "Exchange rate may be out of date",
        satsOnly: () => "Showing sats — no exchange rate available",
      },
    },
  }),
}))

const renderHeader = (props: Partial<React.ComponentProps<typeof BalanceHeader>> = {}) =>
  render(
    <ThemeProvider theme={theme}>
      <BalanceHeader loading={false} formattedBalance="$10" {...props} />
    </ThemeProvider>,
  )

describe("BalanceHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockHideAmount = false
  })

  it("renders the formatted balance", () => {
    const { getByText } = renderHeader({ formattedBalance: "$42.00" })

    expect(getByText("$42.00")).toBeTruthy()
  })

  it("does not render the Stable Balance toggle when showStableBalanceToggle is false", () => {
    const { queryByTestId } = renderHeader({ showStableBalanceToggle: false })

    expect(queryByTestId("balance-mode-toggle")).toBeNull()
  })

  it("renders the SATS label when mode is Btc and toggle is enabled", () => {
    const onModeChange = jest.fn()
    const { getByText } = renderHeader({
      showStableBalanceToggle: true,
      mode: BalanceMode.Btc,
      onModeChange,
    })

    expect(getByText("Balance · SATS")).toBeTruthy()
  })

  it("renders the USD label when mode is Usd and toggle is enabled", () => {
    const { getByText } = renderHeader({
      showStableBalanceToggle: true,
      mode: BalanceMode.Usd,
      onModeChange: jest.fn(),
    })

    expect(getByText("Balance · USD")).toBeTruthy()
  })

  it("calls onModeChange when the toggle is pressed", () => {
    const onModeChange = jest.fn()
    const { getByTestId } = renderHeader({
      showStableBalanceToggle: true,
      mode: BalanceMode.Btc,
      onModeChange,
    })

    fireEvent.press(getByTestId("balance-mode-toggle"))

    expect(onModeChange).toHaveBeenCalledTimes(1)
  })

  it("hides the toggle when onModeChange is not provided even if the flag is true", () => {
    const { queryByTestId } = renderHeader({
      showStableBalanceToggle: true,
      mode: BalanceMode.Btc,
      onModeChange: undefined,
    })

    expect(queryByTestId("balance-mode-toggle")).toBeNull()
  })

  it("caps font scaling on the balance so it cannot overrun the header (blink-wip#931)", () => {
    const { getByTestId } = renderHeader({ formattedBalance: "$42.00" })

    expect(getByTestId("balance-value").props.maxFontSizeMultiplier).toBeLessThanOrEqual(
      1.5,
    )
  })

  it("renders the hidden placeholder instead of the balance when the amount is hidden", () => {
    mockHideAmount = true

    const { getByTestId, queryByTestId } = renderHeader({ formattedBalance: "$42.00" })

    expect(getByTestId("hidden-balance-placeholder")).toBeTruthy()
    expect(queryByTestId("balance-value")).toBeNull()
  })

  it("renders no scalable text in the hidden placeholder (blink-wip#931)", () => {
    mockHideAmount = true

    const { getByTestId } = renderHeader()

    const placeholder = getByTestId("hidden-balance-placeholder")
    expect(within(placeholder).queryByText(/./)).toBeNull()
  })

  describe("the stale-rate notice", () => {
    it("is absent by default", () => {
      const { queryByTestId } = renderHeader()

      // Anchor: the header really rendered.
      expect(queryByTestId("balance-value")).not.toBeNull()
      expect(queryByTestId("balance-rate-notice")).toBeNull()
    })

    it("appears beside the balance when the rate behind it is old", () => {
      const { getByText, getByTestId } = renderHeader({ isRateStale: true })

      // The figure is still shown: an old rate is a caveat on a number, not a reason
      // to withhold it.
      expect(getByTestId("balance-value")).toBeTruthy()
      expect(getByText("Exchange rate may be out of date")).toBeTruthy()
    })

    it("stays hidden while the balance itself is hidden", () => {
      mockHideAmount = true

      const { queryByTestId } = renderHeader({ isRateStale: true })

      // Nothing is on screen to qualify, and the notice would leak that a balance
      // exists to price.
      expect(queryByTestId("balance-value")).toBeNull()
      expect(queryByTestId("balance-rate-notice")).toBeNull()
    })

    it("is not shown while the balance is still loading", () => {
      const { queryByTestId } = renderHeader({ isRateStale: true, loading: true })

      // There is no figure yet to qualify, so the caveat would be noise under a
      // skeleton.
      expect(queryByTestId("balance-value")).toBeNull()
      expect(queryByTestId("balance-rate-notice")).toBeNull()
    })
  })

  describe("the sats-only notice", () => {
    it("says why the amount is in sats", () => {
      const { getByText, getByTestId } = renderHeader({
        isSatsOnly: true,
        formattedBalance: "1,000 SAT",
      })

      expect(getByTestId("balance-value")).toBeTruthy()
      expect(getByText("Showing sats — no exchange rate available")).toBeTruthy()
    })

    it("wins over the stale-rate line rather than stacking with it", () => {
      // "No rate at all" subsumes "the rate is old", and two lines under a balance is
      // one too many.
      const { getByText, queryByText } = renderHeader({
        isSatsOnly: true,
        isRateStale: true,
      })

      expect(getByText("Showing sats — no exchange rate available")).toBeTruthy()
      expect(queryByText("Exchange rate may be out of date")).toBeNull()
    })

    it("stays hidden while the balance itself is hidden", () => {
      mockHideAmount = true

      const { queryByTestId } = renderHeader({ isSatsOnly: true })

      expect(queryByTestId("balance-value")).toBeNull()
      expect(queryByTestId("balance-rate-notice")).toBeNull()
    })
  })
})
