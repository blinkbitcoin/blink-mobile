import React from "react"
import { render, act, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { ModeSwitchSuccessScreen } from "@app/screens/self-custodial/mode-switch-success-screen"
import { AccountMode } from "@app/types/account"

import { ContextForScreen } from "../helper"

const mockGoBack = jest.fn()
let mockRouteParams: { mode: AccountMode } = { mode: AccountMode.Enhanced }

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({ goBack: mockGoBack }),
    useRoute: () => ({ params: mockRouteParams }),
  }
})

loadLocale("en")
const LL = i18nObject("en")

const SUCCESS_DELAY = 3000

describe("ModeSwitchSuccessScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    mockRouteParams = { mode: AccountMode.Enhanced }
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  const renderScreen = async () => {
    const utils = render(
      <ContextForScreen>
        <ModeSwitchSuccessScreen />
      </ContextForScreen>,
    )
    await act(async () => {})
    return utils
  }

  it("confirms the switch to Enhanced", async () => {
    await renderScreen()

    expect(screen.getByText(LL.ModeSwitchSuccessScreen.enhanced())).toBeTruthy()
  })

  it("confirms the switch to Anon", async () => {
    mockRouteParams = { mode: AccountMode.Anon }

    await renderScreen()

    expect(screen.getByText(LL.ModeSwitchSuccessScreen.anon())).toBeTruthy()
  })

  it("returns to the previous screen after the delay", async () => {
    await renderScreen()

    act(() => {
      jest.advanceTimersByTime(SUCCESS_DELAY)
    })

    expect(mockGoBack).toHaveBeenCalledTimes(1)
  })

  it("does not navigate before the delay elapses", async () => {
    await renderScreen()

    act(() => {
      jest.advanceTimersByTime(SUCCESS_DELAY - 1)
    })

    expect(mockGoBack).not.toHaveBeenCalled()
  })
})
