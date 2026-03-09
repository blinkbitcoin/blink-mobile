import { encryptPin } from "@app/screens/card-screen/utils/card-encryption"

jest.mock("@app/utils/crypto", () => ({
  generateRandomHexKey: () => "abcd1234abcd1234abcd1234abcd1234",
  encryptRsaOaep: jest.fn().mockReturnValue("mock-session-id"),
  encryptAesGcm: jest.fn().mockReturnValue({
    data: "mock-encrypted-data",
    iv: "mock-iv",
  }),
}))

jest.mock("@app/screens/card-screen/utils/format-pin-block", () => ({
  formatPinBlock: jest.fn().mockReturnValue("246784FFFFFFFFFF"),
}))

import { encryptRsaOaep, encryptAesGcm } from "@app/utils/crypto"
import { formatPinBlock } from "@app/screens/card-screen/utils/format-pin-block"

describe("encryptPin", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns encryptedPin, iv, and sessionId", () => {
    const result = encryptPin(
      "6784",
      "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
    )

    expect(result).toEqual({
      encryptedPin: "mock-encrypted-data",
      iv: "mock-iv",
      sessionId: "mock-session-id",
    })
  })

  it("calls formatPinBlock with the pin", () => {
    encryptPin("6784", "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----")

    expect(formatPinBlock).toHaveBeenCalledWith("6784")
  })

  it("calls encryptRsaOaep with public key and generated secret key", () => {
    encryptPin("6784", "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----")

    expect(encryptRsaOaep).toHaveBeenCalledWith(
      "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
      "abcd1234abcd1234abcd1234abcd1234",
    )
  })

  it("calls encryptAesGcm with formatted pin block and secret key", () => {
    encryptPin("6784", "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----")

    expect(encryptAesGcm).toHaveBeenCalledWith(
      "246784FFFFFFFFFF",
      "abcd1234abcd1234abcd1234abcd1234",
    )
  })
})
