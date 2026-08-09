import React from "react"
import { StyleSheet } from "react-native"
import { render, screen, fireEvent } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { dark, light } from "@app/rne-theme/colors"

import { MigrationMerchantToolsScreen } from "@app/screens/account-migration/to-non-custodial/merchant-tools-screen"
import { ContextForScreen, ContextForScreenWithTheme } from "../../helper"
import { flushEffects } from "../../../helpers/flush-effects"

loadLocale("en")
const LL = i18nObject("en")
const merchantToolsLL = LL.AccountMigration.merchantTools

const TOOL_ICON_TEST_IDS = [
  "icon-calculator",
  "icon-donation-button",
  "icon-btcpay",
  "icon-woocommerce",
]
const TOOL_ICON_SIZE = 20

const mockGoToNextStep = jest.fn()
/** The destination depends on reads that are still in flight on mount, so tests drive the
 *  hook's loading flag rather than assuming it has always settled. */
let mockNextStepLoading = false

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationNextStep: () => ({
    goToNextStep: mockGoToNextStep,
    replaceToCheckpoint: jest.fn(),
    loading: mockNextStepLoading,
  }),
}))

const renderScreen = () =>
  render(
    <ContextForScreen>
      <MigrationMerchantToolsScreen />
    </ContextForScreen>,
  )

const renderScreenInTheme = (mode: "light" | "dark") =>
  render(
    <ContextForScreenWithTheme mode={mode}>
      <MigrationMerchantToolsScreen />
    </ContextForScreenWithTheme>,
  )

describe("MigrationMerchantToolsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockNextStepLoading = false
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

  it("groups the tools on the grouped-list surface in both themes", async () => {
    renderScreenInTheme("light")
    await flushEffects()

    expect(screen.getByTestId("migration-merchant-tools-card")).toHaveStyle({
      backgroundColor: light.grey5,
    })

    screen.unmount()
    renderScreenInTheme("dark")
    await flushEffects()

    expect(screen.getByTestId("migration-merchant-tools-card")).toHaveStyle({
      backgroundColor: dark.grey5,
    })
  })

  it("separates the tools with a 1pt grey4 rule between each pair", async () => {
    renderScreenInTheme("dark")
    await flushEffects()

    const dividers = screen.getAllByTestId("RNE__Divider")

    expect(dividers).toHaveLength(3)
    dividers.forEach((divider) => {
      expect(StyleSheet.flatten(divider.props.style)).toMatchObject({
        borderBottomColor: dark.grey4,
        borderBottomWidth: 1,
        marginHorizontal: 10,
      })
    })
  })

  it("sizes every tool icon alike", async () => {
    renderScreen()
    await flushEffects()

    TOOL_ICON_TEST_IDS.forEach((testID) => {
      expect(screen.getByTestId(testID).props.width).toBe(TOOL_ICON_SIZE)
      expect(screen.getByTestId(testID).props.height).toBe(TOOL_ICON_SIZE)
    })
  })

  it("draws the tool icons black in the light theme", async () => {
    renderScreenInTheme("light")
    await flushEffects()

    TOOL_ICON_TEST_IDS.forEach((testID) => {
      expect(screen.getByTestId(testID).props.color).toBe(light.black)
    })
  })

  it("draws the tool icons white in the dark theme", async () => {
    renderScreenInTheme("dark")
    await flushEffects()

    TOOL_ICON_TEST_IDS.forEach((testID) => {
      expect(screen.getByTestId(testID).props.color).toBe(dark.black)
    })
  })

  it("keeps the hero accent green while the rows follow the foreground", async () => {
    renderScreenInTheme("dark")
    await flushEffects()

    expect(screen.getByTestId("icon-receive").props.color).toBe(dark._green)
    expect(screen.getByTestId("icon-calculator").props.color).not.toBe(dark._green)
  })

  it("offers a single action, with no way to tap into a tool", async () => {
    renderScreen()
    await flushEffects()

    const [onlyButton, ...extraButtons] = screen.getAllByRole("button")

    expect(onlyButton.props.testID).toBe("migration-merchant-tools-cta")
    expect(extraButtons).toHaveLength(0)
  })

  it("walks on to the next migration step when Got it is pressed", async () => {
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByText(merchantToolsLL.cta()))

    expect(mockGoToNextStep).toHaveBeenCalledTimes(1)
  })

  /** The destination is decided from hasResumableCheckpoint, which reads false until the
   *  checkpoint query settles — so a tap accepted early sends a user who is mid-migration
   *  to the re-provision entry rather than back to the step they left off at. */
  it("refuses the tap until the next step is known", async () => {
    mockNextStepLoading = true
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-merchant-tools-cta"))

    expect(mockGoToNextStep).not.toHaveBeenCalled()
  })

  it("accepts the tap once the next step has settled", async () => {
    mockNextStepLoading = false
    renderScreen()
    await flushEffects()

    fireEvent.press(screen.getByTestId("migration-merchant-tools-cta"))

    expect(mockGoToNextStep).toHaveBeenCalledTimes(1)
  })
})
