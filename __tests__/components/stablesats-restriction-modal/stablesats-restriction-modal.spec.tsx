import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

import { StablesatsRestrictionModal } from "@app/components/stablesats-restriction-modal"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("StablesatsRestrictionModal", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the title", () => {
    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Stablesats is not available in your country")).toBeTruthy()
  })

  it("renders the new body copy nudging users to a non-custodial account", () => {
    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(
      getByText("To get access to a dollar account, create a non-custodial account."),
    ).toBeTruthy()
  })

  it("renders the Create new primary button and the Close secondary button", () => {
    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Create new")).toBeTruthy()
    expect(getByText("Close")).toBeTruthy()
  })

  it("closes the modal and navigates to getStarted when Create new is pressed", () => {
    const toggleModal = jest.fn()
    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={toggleModal} />),
    )

    fireEvent.press(getByText("Create new"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith("getStarted")
  })

  it("closes the modal without navigating when Close is pressed", () => {
    const toggleModal = jest.fn()
    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={toggleModal} />),
    )

    fireEvent.press(getByText("Close"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("fires onDismiss when Close is pressed", () => {
    const onDismiss = jest.fn()
    const { getByText } = render(
      wrap(
        <StablesatsRestrictionModal
          isVisible={true}
          toggleModal={jest.fn()}
          onDismiss={onDismiss}
        />,
      ),
    )

    fireEvent.press(getByText("Close"))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("does not fire onDismiss when Create new is pressed (navigates instead)", () => {
    const onDismiss = jest.fn()
    const { getByText } = render(
      wrap(
        <StablesatsRestrictionModal
          isVisible={true}
          toggleModal={jest.fn()}
          onDismiss={onDismiss}
        />,
      ),
    )

    fireEvent.press(getByText("Create new"))

    expect(onDismiss).not.toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith("getStarted")
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={false} toggleModal={jest.fn()} />),
    )

    expect(queryByText("Stablesats is not available in your country")).toBeNull()
  })
})
