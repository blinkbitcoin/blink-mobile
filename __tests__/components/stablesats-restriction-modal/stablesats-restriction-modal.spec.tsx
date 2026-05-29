import React from "react"
import { render } from "@testing-library/react-native"

import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"

const mockUseActiveWallet = jest.fn()

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
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

  it("uses the custodial title for a custodial active wallet", () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })

    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Stablesats is not available in your country")).toBeTruthy()
  })

  it("uses the self-custodial title when the active wallet is self-custodial", () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })

    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Stablecoins are not available in your country")).toBeTruthy()
  })

  it("shows the shared body regardless of account type", () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: true })

    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(
      getByText(
        "Due to regulatory uncertainty, we cannot offer this feature in your country.",
      ),
    ).toBeTruthy()
  })

  it("renders the Okay primary button", () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })

    const { getByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={true} toggleModal={jest.fn()} />),
    )

    expect(getByText("Okay")).toBeTruthy()
  })

  it("renders nothing when isVisible is false", () => {
    mockUseActiveWallet.mockReturnValue({ isSelfCustodial: false })

    const { queryByText } = render(
      wrap(<StablesatsRestrictionModal isVisible={false} toggleModal={jest.fn()} />),
    )

    expect(queryByText("Stablesats is not available in your country")).toBeNull()
  })
})
