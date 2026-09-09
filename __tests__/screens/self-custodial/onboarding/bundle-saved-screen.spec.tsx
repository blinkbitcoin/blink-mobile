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
  useCompleteBackup: () => mockCompleteBackup,
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
