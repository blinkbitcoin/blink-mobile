import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

import { PendingDepositModal } from "@app/screens/account-migration/pending-deposit-modal"

loadLocale("en")

const TITLE = "There is a pending deposit to your account"
const STILL_CONFIRMING = "Your deposit is not confirmed yet. Try again in a few minutes."

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("PendingDepositModal", () => {
  it("renders the title and body", () => {
    const { getByText } = render(
      wrap(<PendingDepositModal isVisible={true} onAcknowledge={jest.fn()} />),
    )

    expect(getByText(TITLE)).toBeTruthy()
    expect(
      getByText(
        "You cannot migrate to a different type of account before all your pending deposits have been settled and credited on this account.",
      ),
    ).toBeTruthy()
  })

  it("acknowledges from the OK button", () => {
    const onAcknowledge = jest.fn()
    const { getByText } = render(
      wrap(<PendingDepositModal isVisible={true} onAcknowledge={onAcknowledge} />),
    )

    fireEvent.press(getByText("OK"))

    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })

  it("acknowledges from the X icon", () => {
    const onAcknowledge = jest.fn()
    const { getByTestId } = render(
      wrap(<PendingDepositModal isVisible={true} onAcknowledge={onAcknowledge} />),
    )

    fireEvent.press(getByTestId("icon-close"))

    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })

  it("hides the X icon where the user cannot leave", () => {
    const { queryByTestId } = render(
      wrap(
        <PendingDepositModal
          isVisible={true}
          onAcknowledge={jest.fn()}
          showCloseIconButton={false}
        />,
      ),
    )

    expect(queryByTestId("icon-close")).toBeNull()
  })

  it("acknowledges from the backdrop and the hardware back where the user can leave", () => {
    const onAcknowledge = jest.fn()
    const { getByTestId } = render(
      wrap(<PendingDepositModal isVisible={true} onAcknowledge={onAcknowledge} />),
    )

    fireEvent.press(getByTestId("backdrop"))
    fireEvent.press(getByTestId("back-button"))

    expect(onAcknowledge).toHaveBeenCalledTimes(2)
  })

  it("keeps the backdrop and the hardware back inert where the user cannot leave", () => {
    const onAcknowledge = jest.fn()
    const { getByTestId } = render(
      wrap(
        <PendingDepositModal
          isVisible={true}
          onAcknowledge={onAcknowledge}
          showCloseIconButton={false}
        />,
      ),
    )

    fireEvent.press(getByTestId("backdrop"))
    fireEvent.press(getByTestId("back-button"))

    expect(onAcknowledge).not.toHaveBeenCalled()
  })

  it("shows the check running on the OK button in place of its title", () => {
    const { queryByText } = render(
      wrap(
        <PendingDepositModal
          isVisible={true}
          onAcknowledge={jest.fn()}
          showCloseIconButton={false}
          isChecking={true}
        />,
      ),
    )

    expect(queryByText("OK")).toBeNull()
  })

  it("says the deposit is still confirming once the user's check found it pending", () => {
    const { getByText } = render(
      wrap(
        <PendingDepositModal
          isVisible={true}
          onAcknowledge={jest.fn()}
          showCloseIconButton={false}
          isStillPending={true}
        />,
      ),
    )

    expect(getByText(STILL_CONFIRMING)).toBeTruthy()
  })

  it("leaves the still confirming line out by default", () => {
    const { queryByText } = render(
      wrap(<PendingDepositModal isVisible={true} onAcknowledge={jest.fn()} />),
    )

    expect(queryByText(STILL_CONFIRMING)).toBeNull()
  })

  it("offers Contact support where the caller hands it over", () => {
    const onContactSupport = jest.fn()
    const { getByText } = render(
      wrap(
        <PendingDepositModal
          isVisible={true}
          onAcknowledge={jest.fn()}
          onContactSupport={onContactSupport}
        />,
      ),
    )

    fireEvent.press(getByText("Contact support"))

    expect(onContactSupport).toHaveBeenCalledTimes(1)
  })

  it("leaves Contact support out by default", () => {
    const { queryByText } = render(
      wrap(<PendingDepositModal isVisible={true} onAcknowledge={jest.fn()} />),
    )

    expect(queryByText("Contact support")).toBeNull()
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = render(
      wrap(<PendingDepositModal isVisible={false} onAcknowledge={jest.fn()} />),
    )

    expect(queryByText(TITLE)).toBeNull()
  })
})
