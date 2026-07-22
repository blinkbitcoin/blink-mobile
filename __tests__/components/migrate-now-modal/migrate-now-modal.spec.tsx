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

import { MigrateNowModal } from "@app/components/migrate-now-modal"

loadLocale("en")

const TITLE = "Migrate now to a non-custodial account"
const AUG_31_2026_NOON_UTC = Date.UTC(2026, 7, 31, 12) / 1000

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

const renderModal = (overrides?: Partial<React.ComponentProps<typeof MigrateNowModal>>) =>
  render(
    wrap(
      <MigrateNowModal
        isVisible={true}
        toggleModal={jest.fn()}
        onMigrate={jest.fn()}
        deadlineTimestamp={AUG_31_2026_NOON_UTC}
        timezone="UTC"
        {...overrides}
      />,
    ),
  )

describe("MigrateNowModal", () => {
  it("renders the title and the body with the formatted deadline date", () => {
    const { getByText } = renderModal()

    expect(getByText(TITLE)).toBeTruthy()
    expect(getByText(/by the end of August 31\./)).toBeTruthy()
    expect(getByText(/You can no longer receive funds/)).toBeTruthy()
  })

  it("starts the migration from the primary action without closing by itself", () => {
    const toggleModal = jest.fn()
    const onMigrate = jest.fn()
    const { getByText } = renderModal({ toggleModal, onMigrate })

    fireEvent.press(getByText("Migrate now"))

    expect(onMigrate).toHaveBeenCalledTimes(1)
    expect(toggleModal).not.toHaveBeenCalled()
  })

  it("dismisses the modal from the X icon", () => {
    const toggleModal = jest.fn()
    const { getByTestId } = renderModal({ toggleModal })

    fireEvent.press(getByTestId("icon-close"))

    expect(toggleModal).toHaveBeenCalledTimes(1)
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = renderModal({ isVisible: false })

    expect(queryByText(TITLE)).toBeNull()
  })
})
