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

import { UsdbPrivacyWarningModal } from "@app/components/usdb-privacy-warning-modal"

loadLocale("en")

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider>
    <TypesafeI18n locale="en">{ui}</TypesafeI18n>
  </ThemeProvider>
)

describe("UsdbPrivacyWarningModal", () => {
  it("renders the title and explains that dollar activity is public", () => {
    const { getByText } = render(
      wrap(<UsdbPrivacyWarningModal isVisible={true} onAcknowledge={jest.fn()} />),
    )

    expect(getByText("Privacy warning")).toBeTruthy()
    expect(
      getByText(
        "Bitcoin balances and transactions on Spark are private by nature. Unfortunately, this does not apply to non-custodial Dollar transfers and balances relying on the USDB stablecoin. Anyone who knows your LN address can look up your Dollar balance and history.",
      ),
    ).toBeTruthy()
  })

  it("acknowledges once when the primary button is pressed", () => {
    const onAcknowledge = jest.fn()
    const { getByText } = render(
      wrap(<UsdbPrivacyWarningModal isVisible={true} onAcknowledge={onAcknowledge} />),
    )

    fireEvent.press(getByText("Acknowledged"))

    expect(onAcknowledge).toHaveBeenCalledTimes(1)
  })

  it("renders nothing when isVisible is false", () => {
    const { queryByText } = render(
      wrap(<UsdbPrivacyWarningModal isVisible={false} onAcknowledge={jest.fn()} />),
    )

    expect(queryByText("Privacy warning")).toBeNull()
  })
})
