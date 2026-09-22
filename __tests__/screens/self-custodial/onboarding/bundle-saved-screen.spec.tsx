import React from "react"

import { render, screen, act } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { BundleSavedScreen } from "@app/screens/self-custodial/onboarding/manual-backup/bundle-saved-screen"
import { BackupMethod } from "@app/self-custodial/providers/backup-state"

import { ContextForScreen } from "../../helper"

let LL: TranslationFunctions

const mockCompleteBackup = jest.fn()
jest.mock("@app/screens/self-custodial/onboarding/hooks", () => ({
  ...jest.requireActual("@app/screens/self-custodial/onboarding/hooks"),
  /** A fresh identity per render, like the real hook: completeBackup depends on
   *  the backup-state context, and completing a backup re-identifies it. A
   *  stable mock would hide any effect that re-arms on that identity. */
  useCompleteBackup:
    () =>
    (...args: readonly unknown[]) =>
      mockCompleteBackup(...args),
}))

const mockParams = jest.fn<{ successMessage?: string } | undefined, []>()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: mockParams() }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <BundleSavedScreen />
    </ContextForScreen>,
  )

describe("BundleSavedScreen", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockParams.mockReturnValue({ successMessage: "done" })
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("confirms the bundle was saved", () => {
    renderScreen()
    expect(screen.getByText(LL.BackupScreen.BundleExport.savedTitle())).toBeTruthy()
  })

  it("carries no actions", () => {
    renderScreen()
    // The export already happened; a button would only ask the user to
    // acknowledge something that is already true.
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("does not finish the backup while the user is still reading", () => {
    renderScreen()
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })

  it("finishes the backup on its own", () => {
    renderScreen()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(mockCompleteBackup).toHaveBeenCalledWith({
      method: BackupMethod.Manual,
      message: "done",
    })
  })

  it("finishes without a success message when the route carries none", () => {
    // Reached directly (deep link, or a flow that passes nothing) rather than
    // from the export screen.
    mockParams.mockReturnValue(undefined)
    renderScreen()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(mockCompleteBackup).toHaveBeenCalledWith({
      method: BackupMethod.Manual,
      message: undefined,
    })
  })

  /** finish() completes the backup, which re-identifies the backup-state
   *  context and completeBackup with it. A dwell effect keyed on that identity
   *  re-arms after every firing: duplicate analytics, duplicate storage writes,
   *  and the success screen's copy flipping while the user reads it. */
  it("finishes exactly once even when completeBackup re-identifies afterwards", () => {
    const { rerender } = renderScreen()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(mockCompleteBackup).toHaveBeenCalledTimes(1)

    // Stands in for the context churn the completion itself causes.
    rerender(
      <ContextForScreen>
        <BundleSavedScreen />
      </ContextForScreen>,
    )
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(mockCompleteBackup).toHaveBeenCalledTimes(1)
  })

  it("does not finish after unmount", () => {
    const { unmount } = renderScreen()
    unmount()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    // A pending timer firing into a torn-down screen would complete a backup
    // for a flow the user has already left.
    expect(mockCompleteBackup).not.toHaveBeenCalled()
  })
})
