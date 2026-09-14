import React from "react"

import { fireEvent, render } from "@testing-library/react-native"
import { InAppBrowser } from "react-native-inappbrowser-reborn"
import { ThemeProvider, useTheme } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const mockGaloyIcon = jest.fn()
jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: (props: { name: string; color?: string }) => {
    mockGaloyIcon(props)
    return null
  },
}))

jest.mock("react-native-modal", () => {
  const ReactNs = jest.requireActual<typeof import("react")>("react")
  const RN = jest.requireActual<typeof import("react-native")>("react-native")
  const MockModal = ({
    children,
    isVisible,
  }: {
    children: React.ReactNode
    isVisible: boolean
  }) => (isVisible ? ReactNs.createElement(RN.View, null, children) : null)
  return { __esModule: true, default: MockModal }
})

import { BLOCKED_COUNTRIES_FAQ_LINK } from "@app/config"
import { RestrictedRegionModal } from "@app/self-custodial/components/restricted-region-modal"

loadLocale("en")
const LL = i18nObject("en")

/** Reads the palette from inside the same provider the modal renders under, so the
 *  colour assertion follows the theme instead of hardcoding a hex. */
let themeColors: { primary: string } | undefined
const ThemeProbe: React.FC = () => {
  themeColors = useTheme().theme.colors
  return null
}

const renderModal = (onDismiss: () => void, isVisible = true) =>
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <ThemeProbe />
        <RestrictedRegionModal isVisible={isVisible} onDismiss={onDismiss} />
      </TypesafeI18n>
    </ThemeProvider>,
  )

describe("RestrictedRegionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("shows the fixed copy", () => {
    const { getByText } = renderModal(jest.fn())

    expect(getByText(LL.RestrictedRegion.title())).toBeTruthy()
    expect(
      getByText(`${LL.RestrictedRegion.body()}\n\n${LL.RestrictedRegion.bodyReturn()}`),
    ).toBeTruthy()
  })

  it("stays mounted but hidden after a dismiss", () => {
    const { queryByText } = renderModal(jest.fn(), false)

    expect(queryByText(LL.RestrictedRegion.title())).toBeNull()
  })

  it("dismisses on Close", () => {
    const onDismiss = jest.fn()
    const { getByText } = renderModal(onDismiss)

    fireEvent.press(getByText(LL.common.close()))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  /** The brand primary, matching the custodial full-screen block, so the two sanctions
   *  surfaces read as one feature. It must not fall back to the warning colour. */
  it("tints the icon with the theme primary", () => {
    renderModal(jest.fn())

    expect(mockGaloyIcon).toHaveBeenCalledWith(
      expect.objectContaining({ name: "warning", color: themeColors?.primary }),
    )
  })

  /** In-app browser, unlike the full-screen custodial block: this modal is a JS
   *  overlay, so a browser can present above it and the user keeps the session. */
  it("opens the explanation link in the in-app browser on Learn more", () => {
    const openSpy = jest.spyOn(InAppBrowser, "open").mockResolvedValue(undefined as never)
    const { getByText } = renderModal(jest.fn())

    fireEvent.press(getByText(LL.RestrictedRegion.learnMore()))

    expect(openSpy).toHaveBeenCalledWith(BLOCKED_COUNTRIES_FAQ_LINK)
  })
})
