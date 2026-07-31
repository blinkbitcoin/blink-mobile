import React from "react"
import { Linking } from "react-native"

import { fireEvent, render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

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
import { RestrictedRegionModal } from "@app/components/restricted-region/restricted-region-modal"

loadLocale("en")
const LL = i18nObject("en")

const renderModal = (onDismiss: () => void, isVisible = true) =>
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
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

  it("opens the explanation link on Learn more", () => {
    const openUrlSpy = jest
      .spyOn(Linking, "openURL")
      .mockResolvedValue(undefined as never)
    const { getByText } = renderModal(jest.fn())

    fireEvent.press(getByText(LL.RestrictedRegion.learnMore()))

    expect(openUrlSpy).toHaveBeenCalledWith(BLOCKED_COUNTRIES_FAQ_LINK)
  })
})
