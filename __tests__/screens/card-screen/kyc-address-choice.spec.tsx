import React from "react"
import { Text } from "react-native"
import { fireEvent, render } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"

import { KycAddressChoice } from "@app/screens/card-screen/kyc-address-choice"
import { ShippingAddress } from "@app/screens/card-screen/types"

import { ContextForScreen } from "../helper"

const kycAddress: ShippingAddress = {
  firstName: "Satoshi",
  lastName: "Nakamoto",
  line1: "123 Main Street",
  line2: "Apt 4B",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "US",
}

const renderChoice = (props: Partial<React.ComponentProps<typeof KycAddressChoice>>) =>
  render(
    <ContextForScreen>
      <KycAddressChoice
        kycAddress={kycAddress}
        isKycAddressUsed={false}
        onToggle={jest.fn()}
        {...props}
      >
        <Text>address form</Text>
      </KycAddressChoice>
    </ContextForScreen>,
  )

/** The KYC address is a choice, never the default: the box starts unticked, at the top,
 *  with the address form open under it (D42, D123). */
describe("KycAddressChoice", () => {
  beforeEach(() => {
    loadLocale("en")
  })

  it("offers the KYC address unticked, with the form open", () => {
    const { getByRole, getByText, queryByText } = renderChoice({})

    expect(
      getByRole("checkbox", { name: "Use KYC address as shipping address" }).props
        .accessibilityState,
    ).toMatchObject({ checked: false })
    expect(getByText("address form")).toBeTruthy()
    expect(queryByText("KYC address")).toBeNull()
  })

  it("shows the KYC address instead of the form once it is chosen", () => {
    const { getByText, queryByText } = renderChoice({ isKycAddressUsed: true })

    expect(getByText("KYC address")).toBeTruthy()
    expect(getByText("123 Main Street")).toBeTruthy()
    expect(queryByText("address form")).toBeNull()
  })

  it("toggles the choice from the box", () => {
    const onToggle = jest.fn()
    const { getByRole } = renderChoice({ onToggle })

    fireEvent.press(
      getByRole("checkbox", { name: "Use KYC address as shipping address" }),
    )

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  /** Until the API returns the KYC address (blink-wip#2279) there is nothing to offer. */
  it("shows only the form while there is no KYC address", () => {
    const { queryByRole, getByText } = renderChoice({
      kycAddress: null,
      isKycAddressUsed: true,
    })

    expect(queryByRole("checkbox")).toBeNull()
    expect(getByText("address form")).toBeTruthy()
  })
})
