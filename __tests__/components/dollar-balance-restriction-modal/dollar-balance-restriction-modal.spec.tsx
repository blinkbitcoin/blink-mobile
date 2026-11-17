import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

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

  /** An unanswered query is not a verdict: the modal says the check failed and how to ask
   *  again, never that the region is restricted. */
  it("explains the failed check, not a restriction, when the region is unknown", () => {
    const { getByText, queryByText } = render(
      wrap(
        <DollarBalanceRestrictionModal
          isVisible={true}
          toggleModal={jest.fn()}
          isRegionUnknown={true}
        />,
      ),
    )

    expect(getByText("Couldn't check Dollar Balance availability")).toBeTruthy()
    expect(
      getByText(
        "We couldn't check whether the Dollar Balance is available to you. Pull down on the home screen to try again.",
      ),
    ).toBeTruthy()
    expect(queryByText("Dollar Balance is not available in your region")).toBeNull()
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
