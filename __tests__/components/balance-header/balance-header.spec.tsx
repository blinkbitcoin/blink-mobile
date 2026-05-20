import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { BalanceMode } from "@app/hooks/use-balance-mode"

import { BalanceHeader } from "@app/components/balance-header/balance-header"

const mockSwitchMemoryHideAmount = jest.fn()

jest.mock("@app/graphql/hide-amount-context", () => ({
  useHideAmount: () => ({
    hideAmount: false,
    switchMemoryHideAmount: mockSwitchMemoryHideAmount,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      StableBalance: {
        balanceLabelBtc: () => "Balance · SATS",
        balanceLabelUsd: () => "Balance · USD",
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

  it("does not render the status badge by default", () => {
    const { queryByTestId } = renderHeader()

    expect(queryByTestId("balance-status-badge")).toBeNull()
  })

  it("renders the status badge with the given label and status when provided", () => {
    const { getByTestId, getByText } = renderHeader({
      statusBadge: { label: "STALE", status: "warning" },
    })

    expect(getByTestId("balance-status-badge")).toBeTruthy()
    expect(getByText("STALE")).toBeTruthy()
  })

  it("does not render the status badge while loading (avoids flicker during initial load)", () => {
    const { queryByTestId } = renderHeader({
      statusBadge: { label: "STALE", status: "warning" },
      loading: true,
    })

    expect(queryByTestId("balance-status-badge")).toBeNull()
  })
})
