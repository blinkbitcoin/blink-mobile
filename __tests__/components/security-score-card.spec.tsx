import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { SecurityScoreCard } from "@app/components/security-score-card"
import type { SecurityScore } from "@app/hooks/use-security-score"
import theme from "@app/rne-theme/theme"

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)

const mockOnSignalPress = jest.fn()

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SecurityScreen: {
        securityScore: {
          title: ({ done, total }: { done: number; total: number }) =>
            `Security score ${done}/${total}`,
          levelLow: () => "low",
          levelMedium: () => "medium",
          levelHigh: () => "high",
          set: () => "Set",
          enabled: () => "Enabled",
          signals: {
            cloudBackup: () => "Cloud backup",
            manualBackup: () => "Manual backup",
            appLock: () => "App lock (biometrics or PIN)",
            hideBalance: () => "Hide balance",
          },
        },
      },
    },
  }),
}))

const scoreWith = (overrides: Partial<SecurityScore> = {}): SecurityScore => ({
  signals: [
    { key: "cloudBackup", done: false, retriggerable: true },
    { key: "manualBackup", done: false, retriggerable: true },
    { key: "appLock", done: false, retriggerable: false },
    { key: "hideBalance", done: false, retriggerable: false },
  ],
  done: 0,
  total: 4,
  level: "low",
  ...overrides,
})

describe("SecurityScoreCard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the score and level in the header", () => {
    const { getByText } = renderWithTheme(
      <SecurityScoreCard score={scoreWith()} onSignalPress={mockOnSignalPress} />,
    )

    expect(getByText(/Security score 0\/4/)).toBeTruthy()
    expect(getByText(/low/)).toBeTruthy()
  })

  it("shows Set on an undone signal and reports presses", () => {
    const { getByTestId, getAllByText } = renderWithTheme(
      <SecurityScoreCard score={scoreWith()} onSignalPress={mockOnSignalPress} />,
    )

    expect(getAllByText("Set")).toHaveLength(4)
    fireEvent.press(getByTestId("security-score-manualBackup"))

    expect(mockOnSignalPress).toHaveBeenCalledWith("manualBackup")
  })

  it("renders a done toggle-backed signal as Enabled and inert", () => {
    const score = scoreWith({
      signals: [
        { key: "cloudBackup", done: false, retriggerable: true },
        { key: "manualBackup", done: false, retriggerable: true },
        { key: "appLock", done: true, retriggerable: false },
        { key: "hideBalance", done: false, retriggerable: false },
      ],
      done: 1,
    })

    const { getByTestId, getByText } = renderWithTheme(
      <SecurityScoreCard score={score} onSignalPress={mockOnSignalPress} />,
    )

    expect(getByText("Enabled")).toBeTruthy()
    fireEvent.press(getByTestId("security-score-appLock"))

    expect(mockOnSignalPress).not.toHaveBeenCalled()
  })

  it("keeps a done backup signal pressable — backups must stay re-triggerable (#3828)", () => {
    const score = scoreWith({
      signals: [
        { key: "cloudBackup", done: true, retriggerable: true },
        { key: "manualBackup", done: false, retriggerable: true },
        { key: "appLock", done: false, retriggerable: false },
        { key: "hideBalance", done: false, retriggerable: false },
      ],
      done: 1,
    })

    const { getByTestId } = renderWithTheme(
      <SecurityScoreCard score={score} onSignalPress={mockOnSignalPress} />,
    )

    fireEvent.press(getByTestId("security-score-cloudBackup"))

    expect(mockOnSignalPress).toHaveBeenCalledWith("cloudBackup")
  })
})
