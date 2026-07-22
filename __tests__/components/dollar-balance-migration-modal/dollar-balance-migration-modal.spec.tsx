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

import { DollarBalanceMigrationModal } from "@app/components/dollar-balance-migration-modal"

loadLocale("en")

const TITLE = "We cannot migrate your Dollar Balance"

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("DollarBalanceMigrationModal", () => {
  it("renders the title and body", () => {
    const { getByText } = render(
      wrap(
        <DollarBalanceMigrationModal
          isVisible={true}
          toggleModal={jest.fn()}
          onTransfer={jest.fn()}
        />,
      ),
    )

    expect(getByText(TITLE)).toBeTruthy()
    expect(
      getByText(
        "Empty your Dollar Balance first. You can transfer to your Bitcoin Balance in Blink or elsewhere.",
      ),
    ).toBeTruthy()
  })

  /** The two-button variant is gone: the only action is the conversion, offered to every
   *  affected user, so a dead-end Close is never shown. */
  it("runs the transfer action from the single primary button", () => {
    const toggleModal = jest.fn()
    const onTransfer = jest.fn()
    const { getByText, queryByText } = render(
      wrap(
        <DollarBalanceMigrationModal
          isVisible={true}
          toggleModal={toggleModal}
          onTransfer={onTransfer}
        />,
      ),
    )

    expect(queryByText("Close")).toBeNull()
    fireEvent.press(getByText("Transfer"))

    expect(onTransfer).toHaveBeenCalledTimes(1)
    expect(toggleModal).not.toHaveBeenCalled()
  })

  it("closes the modal from the X icon", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = render(
      wrap(
        <DollarBalanceMigrationModal
          isVisible={true}
          toggleModal={toggleModal}
          onTransfer={jest.fn()}
        />,
      ),
    )

    fireEvent.press(getByTestId("icon-close"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = render(
      wrap(
        <DollarBalanceMigrationModal
          isVisible={false}
          toggleModal={jest.fn()}
          onTransfer={jest.fn()}
        />,
      ),
    )

    expect(queryByText(TITLE)).toBeNull()
  })
})
