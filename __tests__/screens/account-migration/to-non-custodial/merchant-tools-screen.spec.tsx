import React from "react"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { MigrationMerchantToolsScreen } from "@app/screens/account-migration/to-non-custodial/merchant-tools-screen"
import { ContextForScreen } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")
const merchantToolsLL = LL.AccountMigration.merchantTools

const mockOnContinue = jest.fn()
const mockOnBack = jest.fn()

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationMerchantToolsScreen onContinue={mockOnContinue} onBack={mockOnBack} />
    </ContextForScreen>,
  )

describe("MigrationMerchantToolsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
  })

  it("renders the receive hero with the title and subtitle", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-receive")).toBeTruthy()
    expect(screen.getByText(merchantToolsLL.title())).toBeTruthy()
    expect(screen.getByText(merchantToolsLL.body())).toBeTruthy()
  })

  it("lists the four tools that keep working with their descriptions", async () => {
    renderScreen()
    await flushEffects()

    const tools = [
      [merchantToolsLL.terminalTitle(), merchantToolsLL.terminalBody()],
      [merchantToolsLL.donationTitle(), merchantToolsLL.donationBody()],
      [merchantToolsLL.btcpayTitle(), merchantToolsLL.btcpayBody()],
      [merchantToolsLL.woocommerceTitle(), merchantToolsLL.woocommerceBody()],
    ]

    tools.forEach(([title, body]) => {
      expect(screen.getByText(title)).toBeTruthy()
      expect(screen.getByText(body)).toBeTruthy()
    })
  })

  it("shows each tool with the icon its Settings row uses", async () => {
    renderScreen()
    await flushEffects()

    expect(screen.getByTestId("icon-calculator")).toBeTruthy()
    expect(screen.getByTestId("icon-donation-button")).toBeTruthy()
    expect(screen.getByTestId("icon-btcpay")).toBeTruthy()
    expect(screen.getByTestId("icon-woocommerce")).toBeTruthy()
  })

  it("offers a single action, with no way to tap into a tool", async () => {
    renderScreen()
    await flushEffects()

    const [onlyButton, ...extraButtons] = screen.getAllByRole("button")

    expect(onlyButton.props.testID).toBe("migration-merchant-tools-cta")
    expect(extraButtons).toHaveLength(0)
  })

  it("continues the migration when Got it is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(merchantToolsLL.cta()))

    expect(mockOnContinue).toHaveBeenCalledTimes(1)
    expect(mockOnBack).not.toHaveBeenCalled()
  })

  it("steps back on the hardware back instead of exiting the flow", async () => {
    const { BackHandler } =
      jest.requireActual<typeof import("react-native")>("react-native")
    const addListenerSpy = jest.spyOn(BackHandler, "addEventListener")
    renderScreen()
    await flushEffects()

    const handler = addListenerSpy.mock.calls[0][1] as () => boolean

    expect(handler()).toBe(true)
    expect(mockOnBack).toHaveBeenCalledTimes(1)
  })

  it("goes back through the header arrow", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-merchant-tools-back"))

    expect(mockOnBack).toHaveBeenCalledTimes(1)
    expect(mockOnContinue).not.toHaveBeenCalled()
  })
})
