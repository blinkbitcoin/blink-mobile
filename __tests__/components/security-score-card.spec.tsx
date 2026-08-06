import React from "react"
import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { SecurityScoreCard } from "@app/components/security-score-card"
import {
  computeSecurityScore,
  deviceSecuritySignals,
} from "@app/hooks/use-security-score"
import type { BackupMethod } from "@app/self-custodial/providers/backup-state"
import { selfCustodialSecuritySignals } from "@app/self-custodial/hooks/use-security-signals"
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

// Fixtures come from the real signal builders + scorer, so done/total/level can
// never disagree with the signal list the way hand-written literals could.
const score = ({
  completedMethods = [] as BackupMethod[],
  isAppLockEnabled = false,
  isHideBalanceEnabled = false,
} = {}) =>
  computeSecurityScore([
    ...selfCustodialSecuritySignals(completedMethods),
    ...deviceSecuritySignals(
      { isBiometricsEnabled: isAppLockEnabled, isPinEnabled: false },
      isHideBalanceEnabled,
    ),
  ])

describe("SecurityScoreCard", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the score and level in the header", () => {
    const { getByText } = renderWithTheme(
      <SecurityScoreCard score={score()} onSignalPress={mockOnSignalPress} />,
    )

    expect(getByText(/Security score 0\/4/)).toBeTruthy()
    expect(getByText(/low/)).toBeTruthy()
  })

  it("shows Set on an undone signal and reports presses", () => {
    const { getByTestId, getAllByText } = renderWithTheme(
      <SecurityScoreCard score={score()} onSignalPress={mockOnSignalPress} />,
    )

    expect(getAllByText("Set")).toHaveLength(4)
    fireEvent.press(getByTestId("security-score-manualBackup"))

    expect(mockOnSignalPress).toHaveBeenCalledWith("manualBackup")
  })

  it("renders a done toggle-backed signal as Enabled and inert", () => {
    const { getByTestId, getByText } = renderWithTheme(
      <SecurityScoreCard
        score={score({ isAppLockEnabled: true })}
        onSignalPress={mockOnSignalPress}
      />,
    )

    expect(getByText("Enabled")).toBeTruthy()
    fireEvent.press(getByTestId("security-score-appLock"))

    expect(mockOnSignalPress).not.toHaveBeenCalled()
  })

  it("switches the header to the high state at full score", () => {
    const { getByText, queryByText } = renderWithTheme(
      <SecurityScoreCard
        score={score({
          completedMethods: ["cloud", "manual"],
          isAppLockEnabled: true,
          isHideBalanceEnabled: true,
        })}
        onSignalPress={mockOnSignalPress}
      />,
    )

    expect(getByText(/Security score 4\/4/)).toBeTruthy()
    expect(getByText(/high/)).toBeTruthy()
    expect(queryByText("Set")).toBeNull()
  })

  it("keeps a done backup signal pressable — backups must stay re-triggerable (#3828)", () => {
    const { getByTestId } = renderWithTheme(
      <SecurityScoreCard
        score={score({ completedMethods: ["cloud"] })}
        onSignalPress={mockOnSignalPress}
      />,
    )

    fireEvent.press(getByTestId("security-score-cloudBackup"))

    expect(mockOnSignalPress).toHaveBeenCalledWith("cloudBackup")
  })
})
