import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import { StableTokenRestrictionModal } from "@app/components/stable-token-restriction-modal"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("StableTokenRestrictionModal", () => {
  it("renders the title", () => {
    const { getByText } = render(
      wrap(<StableTokenRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Dollar balance is not available in your region")).toBeTruthy()
  })

  it("renders the informational body reassuring Bitcoin still works", () => {
    const { getByText } = render(
      wrap(<StableTokenRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(
      getByText(
        "Your dollar balance is not available in your region. You can still send and receive Bitcoin.",
      ),
    ).toBeTruthy()
  })

  it("renders only the Close button, without a Create new action", () => {
    const { getByText, queryByText } = render(
      wrap(<StableTokenRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Close")).toBeTruthy()
    expect(queryByText("Create new")).toBeNull()
  })

  it("closes the modal when Close is pressed", () => {
    const toggleModal = jest.fn()
    const { getByText } = render(
      wrap(<StableTokenRestrictionModal isVisible={true} toggleModal={toggleModal} />),
    )

    fireEvent.press(getByText("Close"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = render(
      wrap(<StableTokenRestrictionModal isVisible={false} toggleModal={jest.fn()} />),
    )

    expect(queryByText("Dollar balance is not available in your region")).toBeNull()
  })
})
