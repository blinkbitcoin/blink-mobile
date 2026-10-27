import React from "react"

import { render, screen, act } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { BundleSavedScreen } from "@app/screens/self-custodial/onboarding/manual-backup/bundle-saved-screen"

import { ContextForScreen } from "../../helper"

let LL: TranslationFunctions

const mockReplace = jest.fn()
/** Stable like the real navigation object, so the dwell is not re-armed by a
 *  fresh identity on every render. */
const mockNavigation = { replace: mockReplace }
const mockParams = jest.fn<
  { successMessage?: string; reBackup?: boolean } | undefined,
  []
>()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: mockParams() }),
  useNavigation: () => mockNavigation,
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
    mockParams.mockReturnValue({ successMessage: "done", reBackup: true })
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

  it("does not move on while the user is still reading", () => {
    renderScreen()
    act(() => {
      jest.advanceTimersByTime(500)
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("moves on to the backup's success screen on its own, carrying the route's message and re-backup flag", () => {
    renderScreen()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: true,
      message: "done",
    })
  })

  it("moves on without a message when the route carries none", () => {
    mockParams.mockReturnValue(undefined)
    renderScreen()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(mockReplace).toHaveBeenCalledWith("selfCustodialBackupSuccess", {
      reBackup: undefined,
      message: undefined,
    })
  })

  it("moves on exactly once across re-renders", () => {
    const { rerender } = renderScreen()

    act(() => {
      jest.advanceTimersByTime(2000)
    })
    rerender(
      <ContextForScreen>
        <BundleSavedScreen />
      </ContextForScreen>,
    )
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(mockReplace).toHaveBeenCalledTimes(1)
  })

  it("does not move on after unmount", () => {
    const { unmount } = renderScreen()
    unmount()
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
