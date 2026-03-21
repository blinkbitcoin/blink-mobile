import {
  generateRandomHexKey,
  encryptRsaOaep,
  encryptAesGcm,
  decryptAesGcm,
} from "@app/utils/crypto"

const mockDecipherUpdate = jest.fn().mockReturnValue(Buffer.from("decrypted"))
const mockDecipherFinal = jest.fn().mockReturnValue(Buffer.from(""))
const mockSetAuthTag = jest.fn()

jest.mock("react-native-quick-crypto", () => {
  const mockCipher = {
    update: jest.fn().mockReturnValue(Buffer.from("encrypted")),
    final: jest.fn().mockReturnValue(Buffer.from("")),
    getAuthTag: jest.fn().mockReturnValue(Buffer.from("0123456789abcdef")),
  }

  const mockDecipher = {
    update: (...args: readonly unknown[]) => mockDecipherUpdate(...args),
    final: () => mockDecipherFinal(),
    setAuthTag: (...args: readonly unknown[]) => mockSetAuthTag(...args),
  }

  return {
    __esModule: true,
    default: {
      randomBytes: jest.fn((size: number) => Buffer.alloc(size, 0xab)),
      publicEncrypt: jest.fn().mockReturnValue(Buffer.from("rsa-encrypted-data")),
      createCipheriv: jest.fn().mockReturnValue(mockCipher),
      createDecipheriv: jest.fn().mockReturnValue(mockDecipher),
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

  describe("decryptAesGcm", () => {
    beforeEach(() => {
      mockDecipherUpdate.mockReturnValue(Buffer.from("decrypted"))
      mockDecipherFinal.mockReturnValue(Buffer.from(""))
      mockSetAuthTag.mockClear()
    })

    it("returns a decrypted utf8 string", () => {
      const cipherData = Buffer.concat([
        Buffer.from("encrypted-content"),
        Buffer.from("0123456789abcdef"),
      ]).toString("base64")
      const iv = Buffer.from("1234567890123456").toString("base64")
      const hexKey = "abcd1234abcd1234abcd1234abcd1234"

      const result = decryptAesGcm(cipherData, iv, hexKey)

      expect(typeof result).toBe("string")
      expect(result).toBe("decrypted")
    })

    it("creates decipher with aes-128-gcm", () => {
      const Crypto = jest.requireMock("react-native-quick-crypto").default
      Crypto.createDecipheriv.mockClear()

      const cipherData = Buffer.concat([
        Buffer.from("encrypted-content"),
        Buffer.from("0123456789abcdef"),
      ]).toString("base64")
      const iv = Buffer.from("1234567890123456").toString("base64")

      decryptAesGcm(cipherData, iv, "abcd1234abcd1234abcd1234abcd1234")

      expect(Crypto.createDecipheriv).toHaveBeenCalledWith(
        "aes-128-gcm",
        expect.any(Uint8Array),
        expect.any(Buffer),
      )
    })

    it("sets the auth tag from the last 16 bytes of cipher data", () => {
      const content = Buffer.from("encrypted-content")
      const authTag = Buffer.from("auth-tag-16bytes")
      const cipherData = Buffer.concat([content, authTag]).toString("base64")
      const iv = Buffer.from("1234567890123456").toString("base64")

      decryptAesGcm(cipherData, iv, "abcd1234abcd1234abcd1234abcd1234")

      expect(mockSetAuthTag).toHaveBeenCalledTimes(1)
    })
  })
})
