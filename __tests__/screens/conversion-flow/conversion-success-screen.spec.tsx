import React from "react"
import { render, act } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { ConversionSuccessScreen } from "@app/screens/conversion-flow/conversion-success-screen"

import { ContextForScreen } from "../helper"

const mockPopToTop = jest.fn()
const mockReplace = jest.fn()
let mockRouteParams: { returnToMigration?: boolean } | undefined

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({ popToTop: mockPopToTop, replace: mockReplace }),
    useRoute: () => ({ params: mockRouteParams }),
  }
})

const SUCCESS_DELAY = 3000

describe("ConversionSuccessScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockRouteParams = undefined
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const renderScreen = () =>
    render(
      <ContextForScreen>
        <ConversionSuccessScreen />
      </ContextForScreen>,
    )

  it("returns to Home after the delay for a standalone conversion", () => {
    renderScreen()

    act(() => {
      jest.advanceTimersByTime(SUCCESS_DELAY)
    })

    expect(mockPopToTop).toHaveBeenCalledTimes(1)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("hands off to the migration entry for a migration conversion", () => {
    mockRouteParams = { returnToMigration: true }

    renderScreen()

    act(() => {
      jest.advanceTimersByTime(SUCCESS_DELAY)
    })

    expect(mockReplace).toHaveBeenCalledWith("accountMigrationEntry")
    expect(mockPopToTop).not.toHaveBeenCalled()
  })

  it("does not navigate before the delay elapses", () => {
    renderScreen()

    act(() => {
      jest.advanceTimersByTime(SUCCESS_DELAY - 1)
    })

    expect(mockPopToTop).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
