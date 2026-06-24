import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
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

import { DollarBalanceRestrictionModal } from "@app/components/dollar-balance-restriction-modal"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("DollarBalanceRestrictionModal", () => {
  it("renders the title", () => {
    const { getByText } = render(
      wrap(<DollarBalanceRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Dollar Balance is not available in your region")).toBeTruthy()
  })

  it("closes the modal when the Close button is pressed", () => {
    const toggleModal = jest.fn()
    const { getByText } = render(
      wrap(<DollarBalanceRestrictionModal isVisible={true} toggleModal={toggleModal} />),
    )

    fireEvent.press(getByText("Close"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = render(
      wrap(<DollarBalanceRestrictionModal isVisible={false} toggleModal={jest.fn()} />),
    )

    expect(queryByText("Dollar Balance is not available in your region")).toBeNull()
  })
})
