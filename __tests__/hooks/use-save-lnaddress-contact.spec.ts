import { renderHook } from "@testing-library/react-hooks"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { ContactType } from "@app/graphql/generated"
import { useSaveLnAddressContact } from "@app/screens/send-bitcoin-screen/use-save-lnaddress-contact"

const mockContactCreate = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useContactCreateMutation: () => [mockContactCreate],
}))

describe("useSaveLnAddressContact", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should save contact for valid lnurl payment (non-merchant)", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lnurl,
      destination: "user@example.com",
      isMerchant: false,
    })

    expect(response.saved).toBe(true)
    expect(response.handle).toBe("user@example.com")
    expect(mockContactCreate).toHaveBeenCalledWith({
      variables: {
        input: {
          handle: "user@example.com",
          type: ContactType.Lnaddress,
        },
      },
    })
  })

  it("should not save contact when isMerchant is true", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lnurl,
      destination: "merchant@example.com",
      isMerchant: true,
    })

    expect(response.saved).toBe(false)
    expect(response.handle).toBeUndefined()
    expect(mockContactCreate).not.toHaveBeenCalled()
  })

  it("should not save contact when payment type is not lnurl", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lightning,
      destination: "lnbc...",
      isMerchant: false,
    })

    expect(response.saved).toBe(false)
    expect(mockContactCreate).not.toHaveBeenCalled()
  })

  it("should not save contact when destination is not a valid lightning address", async () => {
    const { result } = renderHook(() => useSaveLnAddressContact())

    const response = await result.current({
      paymentType: PaymentType.Lnurl,
      destination: "invalid-destination",
      isMerchant: false,
    })

    expect(response.saved).toBe(false)
    expect(mockContactCreate).not.toHaveBeenCalled()
  })
})
