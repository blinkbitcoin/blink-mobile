import { act, renderHook } from "@testing-library/react-hooks"

import { useShippingAddressDraft } from "@app/screens/card-screen/hooks/use-shipping-address-draft"
import { ShippingAddress } from "@app/screens/card-screen/types"

jest.mock("@app/utils/address-metadata", () => ({
  getRegionsByCountry: (countryCode: string) => [
    { value: `${countryCode}-FIRST`, label: "First region" },
  ],
}))

const mockDeviceLocation = jest.fn(() => ({ countryCode: "US", loading: false }))

jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => mockDeviceLocation(),
}))

const cardholderAddress: ShippingAddress = {
  firstName: "Satoshi",
  lastName: "Nakamoto",
  line1: "123 Main Street",
  line2: "Apt 4B",
  city: "New York",
  region: "NY",
  postalCode: "10001",
  countryCode: "US",
}

/** The member is invited to send the card somewhere other than home (D42), so a new
 *  address never starts as the one on file: only the cardholder's name carries over. */
describe("useShippingAddressDraft", () => {
  beforeEach(() => {
    mockDeviceLocation.mockReturnValue({ countryCode: "US", loading: false })
  })

  it("starts with the cardholder's name and an empty address", () => {
    const { result } = renderHook(() => useShippingAddressDraft(cardholderAddress))

    expect(result.current[0]).toEqual({
      firstName: "Satoshi",
      lastName: "Nakamoto",
      line1: "",
      line2: "",
      city: "",
      region: "US-FIRST",
      postalCode: "",
      countryCode: "US",
    })
  })

  it("starts without a name when there is no cardholder yet", () => {
    const { result } = renderHook(() => useShippingAddressDraft(null))

    expect(result.current[0].firstName).toBe("")
    expect(result.current[0].lastName).toBe("")
  })

  it("takes the cardholder's name once it arrives", () => {
    const { result, rerender } = renderHook(
      ({ cardholder }) => useShippingAddressDraft(cardholder),
      { initialProps: { cardholder: null as ShippingAddress | null } },
    )

    rerender({ cardholder: cardholderAddress })

    expect(result.current[0].firstName).toBe("Satoshi")
    expect(result.current[0].line1).toBe("")
  })

  it("keeps the name the member typed when the cardholder changes later", () => {
    const { result, rerender } = renderHook(
      ({ cardholder }) => useShippingAddressDraft(cardholder),
      { initialProps: { cardholder: cardholderAddress as ShippingAddress | null } },
    )

    act(() => {
      result.current[1]({ ...result.current[0], firstName: "Hal" })
    })
    rerender({ cardholder: { ...cardholderAddress, firstName: "Different" } })

    expect(result.current[0].firstName).toBe("Hal")
  })

  it("defaults to the country the device is in, with its first region", () => {
    mockDeviceLocation.mockReturnValue({ countryCode: "AR", loading: false })

    const { result } = renderHook(() => useShippingAddressDraft(cardholderAddress))

    expect(result.current[0].countryCode).toBe("AR")
    expect(result.current[0].region).toBe("AR-FIRST")
    expect(result.current[0].firstName).toBe("Satoshi")
  })

  it("applies the device's country only once", () => {
    mockDeviceLocation.mockReturnValue({ countryCode: "AR", loading: false })
    const { result, rerender } = renderHook(() =>
      useShippingAddressDraft(cardholderAddress),
    )

    act(() => {
      result.current[1]({ ...result.current[0], countryCode: "SV", region: "SS" })
    })
    mockDeviceLocation.mockReturnValue({ countryCode: "BR", loading: false })
    rerender()

    expect(result.current[0].countryCode).toBe("SV")
  })
})
