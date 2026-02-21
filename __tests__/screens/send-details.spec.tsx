import React from "react"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { Intraledger } from "../../app/screens/send-bitcoin-screen/send-bitcoin-details-screen.stories"
import { ContextForScreen } from "./helper"

jest.mock("@react-native-firebase/app-check", () => {
  return () => ({
    initializeAppCheck: jest.fn(),
    getToken: jest.fn(),
    newReactNativeFirebaseAppCheckProvider: () => ({
      configure: jest.fn(),
    }),
  })
})

jest.mock("react-native-config", () => {
  return {
    APP_CHECK_ANDROID_DEBUG_TOKEN: "token",
    APP_CHECK_IOS_DEBUG_TOKEN: "token",
  }
})

jest.mock("@gorhom/bottom-sheet")

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

it("SendScreen Details", async () => {
  render(
    <ContextForScreen>
      <Intraledger />
    </ContextForScreen>,
  )
  await act(async () => {})
})

it("applies send amount only after modal dismiss animation completes", async () => {
  loadLocale("en")
  const LL = i18nObject("en")

  render(
    <ContextForScreen>
      <Intraledger />
    </ContextForScreen>,
  )

  const nextButton = await screen.findByTestId(LL.common.next())
  expect(nextButton.props.accessibilityState?.disabled).toBe(true)

  await flushAsync()
  await flushAsync()

  fireEvent.press(screen.getByTestId("Amount Input Button"))
  await flushAsync()

  expect(screen.getByTestId("bottom-sheet-modal")).toBeTruthy()

  fireEvent.press(screen.getByTestId("Key 1"))
  await flushAsync()

  jest.useFakeTimers()
  try {
    const setAmountButtons = screen.getAllByText(LL.AmountInputScreen.setAmount())
    fireEvent.press(setAmountButtons[setAmountButtons.length - 1])

    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      true,
    )
    act(() => {
      jest.advanceTimersByTime(39)
    })
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      true,
    )
    act(() => {
      jest.advanceTimersByTime(1)
    })
  } finally {
    jest.useRealTimers()
  }

  await waitFor(() => {
    expect(screen.getByTestId(LL.common.next()).props.accessibilityState?.disabled).toBe(
      false,
    )
  })
})
