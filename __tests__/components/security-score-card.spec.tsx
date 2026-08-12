import React from "react"
import { StyleSheet, type StyleProp, type TextStyle } from "react-native"
import { fireEvent, render, screen } from "@testing-library/react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyIcon } from "@app/components/atomic/galoy-icon"
import { SecurityScoreCard } from "@app/components/security-score-card"
import { SegmentedProgressBar } from "@app/components/segmented-progress-bar"
import {
  computeSecurityScore,
  deviceSecuritySignals,
} from "@app/hooks/use-security-score"
import type { BackupMethod } from "@app/self-custodial/providers/backup-state"
import { selfCustodialSecuritySignals } from "@app/self-custodial/hooks/use-security-signals"
import theme from "@app/rne-theme/theme"

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)

const flexShrinkOf = (node: ReactTestInstance) =>
  StyleSheet.flatten(node.props.style as StyleProp<TextStyle>)?.flexShrink

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
            appLock: () => "Biometrics/PIN",
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

  it("shows the score in the header without spelling out the level", () => {
    const { getByText, queryByText } = renderWithTheme(
      <SecurityScoreCard score={score()} onSignalPress={mockOnSignalPress} />,
    )

    expect(getByText("Security score 0/4")).toBeTruthy()
    expect(queryByText(/low/)).toBeNull()
  })

  /** The level only reaches sighted users through the icon and the colour. */
  it("names the level in the header's accessibility label", () => {
    const { getByLabelText } = renderWithTheme(
      <SecurityScoreCard score={score()} onSignalPress={mockOnSignalPress} />,
    )

    expect(getByLabelText("Security score 0/4 - low")).toBeTruthy()
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
    const { getByLabelText, queryByText } = renderWithTheme(
      <SecurityScoreCard
        score={score({
          completedMethods: ["cloud", "manual"],
          isAppLockEnabled: true,
          isHideBalanceEnabled: true,
        })}
        onSignalPress={mockOnSignalPress}
      />,
    )

    expect(getByLabelText("Security score 4/4 - high")).toBeTruthy()
    expect(queryByText("Set")).toBeNull()
  })

  it("keeps a done backup signal pressable, so backups stay re-triggerable (#3828)", () => {
    const { getByTestId } = renderWithTheme(
      <SecurityScoreCard
        score={score({ completedMethods: ["cloud"] })}
        onSignalPress={mockOnSignalPress}
      />,
    )

    fireEvent.press(getByTestId("security-score-cloudBackup"))

    expect(mockOnSignalPress).toHaveBeenCalledWith("cloudBackup")
  })

  it("tracks the score with a progress bar under the card", () => {
    renderWithTheme(
      <SecurityScoreCard
        score={score({ completedMethods: ["manual"], isAppLockEnabled: true })}
        onSignalPress={mockOnSignalPress}
      />,
    )

    expect(screen.UNSAFE_getByType(SegmentedProgressBar).props).toMatchObject({
      total: 4,
      filled: 2,
    })
  })

  /** The status word already carries the state; a second glyph beside it was
   *  design noise, and the header icon is the only one the card renders. */
  it("marks a done signal with the status word alone, no row icon", () => {
    renderWithTheme(
      <SecurityScoreCard
        score={score({ isAppLockEnabled: true })}
        onSignalPress={mockOnSignalPress}
      />,
    )

    expect(screen.UNSAFE_getAllByType(GaloyIcon)).toHaveLength(1)
  })

  /** Enlarged system text must wrap inside the row instead of running into the
   *  status word that shares the line with it. */
  it("lets the header and the signal labels wrap rather than collide", () => {
    const { getByText } = renderWithTheme(
      <SecurityScoreCard score={score()} onSignalPress={mockOnSignalPress} />,
    )

    expect(flexShrinkOf(getByText("Security score 0/4"))).toBe(1)
    expect(flexShrinkOf(getByText("Biometrics/PIN"))).toBe(1)
  })
})
