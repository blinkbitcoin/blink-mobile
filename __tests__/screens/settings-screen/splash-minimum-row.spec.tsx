import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"
import { it } from "@jest/globals"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { SplashMinimumRow } from "@app/screens/settings-screen/notifications-screen"

import { ContextForScreen } from "../helper"

let mockMinSats = 100
const mockSetMinSats = jest.fn()
jest.mock(
  "@app/screens/receive-bitcoin-screen/incoming-transaction-splash/use-splash-settings",
  () => ({
    useSplashSettings: () => ({
      enabled: true,
      minSats: mockMinSats,
      setEnabled: jest.fn(),
      setMinSats: mockSetMinSats,
    }),
    toastSplashSetting: jest.fn(),
  }),
)

const renderRow = () =>
  render(
    <ContextForScreen>
      <SplashMinimumRow />
    </ContextForScreen>,
  )

const rerenderRow = (view: ReturnType<typeof renderRow>) =>
  view.rerender(
    <ContextForScreen>
      <SplashMinimumRow />
    </ContextForScreen>,
  )

describe("SplashMinimumRow", () => {
  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockMinSats = 100
  })

  it("follows the remote-config minimum once it resolves", async () => {
    const view = renderRow()
    expect(await screen.findByDisplayValue("100")).toBeTruthy()

    mockMinSats = 500
    rerenderRow(view)

    expect(await screen.findByDisplayValue("500")).toBeTruthy()
  })

  it("never saves an unchanged value as the user's own", async () => {
    renderRow()
    const input = await screen.findByDisplayValue("100")

    fireEvent(input, "focus")
    fireEvent(input, "endEditing")

    expect(mockSetMinSats).not.toHaveBeenCalled()
  })

  it("keeps a value being typed when remote config resolves", async () => {
    const view = renderRow()
    const input = await screen.findByDisplayValue("100")

    fireEvent(input, "focus")
    fireEvent.changeText(input, "250")
    mockMinSats = 500
    rerenderRow(view)

    expect(await screen.findByDisplayValue("250")).toBeTruthy()

    fireEvent(screen.getByDisplayValue("250"), "endEditing")
    expect(mockSetMinSats).toHaveBeenCalledWith(250)
  })

  it("names the field for a screen reader", async () => {
    renderRow()
    await screen.findByDisplayValue("100")

    expect(screen.getByLabelText("Minimum amount (SAT)").props.value).toBe("100")
  })

  it("keeps a remote-config minimum that resolved while the field was focused", async () => {
    const view = renderRow()
    const input = await screen.findByDisplayValue("100")

    fireEvent(input, "focus")
    mockMinSats = 500
    rerenderRow(view)
    fireEvent(screen.getByDisplayValue("100"), "endEditing")

    expect(mockSetMinSats).not.toHaveBeenCalled()
    expect(await screen.findByDisplayValue("500")).toBeTruthy()
  })
})
