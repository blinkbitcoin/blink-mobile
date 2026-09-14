import React from "react"
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

import { AnonModeConvertModal } from "@app/self-custodial/components/anon-mode-convert-modal"

loadLocale("en")
const LL = i18nObject("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("AnonModeConvertModal", () => {
  it("renders the title, body and Transfer action", () => {
    const { getByText } = render(
      wrap(
        <AnonModeConvertModal
          isVisible={true}
          toggleModal={jest.fn()}
          onTransfer={jest.fn()}
        />,
      ),
    )

    expect(getByText(LL.AnonModeConvertModal.title())).toBeTruthy()
    expect(getByText(LL.AnonModeConvertModal.body())).toBeTruthy()
    expect(getByText(LL.common.transfer())).toBeTruthy()
  })

  it("runs the conversion callback from the Transfer button", () => {
    const onTransfer = jest.fn()
    const { getByText } = render(
      wrap(
        <AnonModeConvertModal
          isVisible={true}
          toggleModal={jest.fn()}
          onTransfer={onTransfer}
        />,
      ),
    )

    fireEvent.press(getByText(LL.common.transfer()))

    expect(onTransfer).toHaveBeenCalledTimes(1)
  })

  it("renders nothing while hidden", () => {
    const { queryByText } = render(
      wrap(
        <AnonModeConvertModal
          isVisible={false}
          toggleModal={jest.fn()}
          onTransfer={jest.fn()}
        />,
      ),
    )

    expect(queryByText(LL.AnonModeConvertModal.title())).toBeNull()
  })
})
