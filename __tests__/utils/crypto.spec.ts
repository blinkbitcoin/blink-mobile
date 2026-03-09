import { generateRandomHexKey, encryptRsaOaep, encryptAesGcm } from "@app/utils/crypto"

jest.mock("react-native-quick-crypto", () => {
  const mockCipher = {
    update: jest.fn().mockReturnValue(Buffer.from("encrypted")),
    final: jest.fn().mockReturnValue(Buffer.from("")),
    getAuthTag: jest.fn().mockReturnValue(Buffer.from("0123456789abcdef")),
  }

  return {
    __esModule: true,
    default: {
      randomBytes: jest.fn((size: number) => Buffer.alloc(size, 0xab)),
      publicEncrypt: jest.fn().mockReturnValue(Buffer.from("rsa-encrypted-data")),
      createCipheriv: jest.fn().mockReturnValue(mockCipher),
      constants: {
        RSA_PKCS1_OAEP_PADDING: 4,
      },
    },
  }
})

describe("crypto utils", () => {
  describe("generateRandomHexKey", () => {
    it("returns a 32-character hex string", () => {
      const key = generateRandomHexKey()
      expect(key).toHaveLength(32)
      expect(key).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe("encryptRsaOaep", () => {
    it("returns a base64-encoded string", () => {
      const result = encryptRsaOaep(
        "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
        "abcd1234abcd1234abcd1234abcd1234",
      )
      expect(typeof result).toBe("string")
      expect(result.length).toBeGreaterThan(0)
    })

    it("calls publicEncrypt with OAEP padding and sha1", () => {
      const Crypto = jest.requireMock("react-native-quick-crypto").default
      Crypto.publicEncrypt.mockClear()

      encryptRsaOaep(
        "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
        "abcd1234abcd1234abcd1234abcd1234",
      )

      expect(Crypto.publicEncrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          padding: 4,
          oaepHash: "sha1",
        }),
        expect.any(Buffer),
      )
    })
  })

  describe("encryptAesGcm", () => {
    it("returns data and iv as base64 strings", () => {
      const result = encryptAesGcm("plaintext", "abcd1234abcd1234abcd1234abcd1234")
      expect(typeof result.data).toBe("string")
      expect(typeof result.iv).toBe("string")
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.iv.length).toBeGreaterThan(0)
    })

    it("creates cipher with aes-128-gcm", () => {
      const Crypto = jest.requireMock("react-native-quick-crypto").default
      Crypto.createCipheriv.mockClear()

      encryptAesGcm("plaintext", "abcd1234abcd1234abcd1234abcd1234")

      expect(Crypto.createCipheriv).toHaveBeenCalledWith(
        "aes-128-gcm",
        expect.any(Uint8Array),
        expect.anything(),
      )
    })
  })
})
