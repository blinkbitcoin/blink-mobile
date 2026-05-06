import {
  generateRandomHexKey,
  encryptRsaOaep,
  encryptAesGcm,
  deriveKeyFromPassword,
} from "@app/utils/crypto"

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
      pbkdf2Sync: jest.fn((...args: readonly unknown[]) =>
        Buffer.alloc(args[3] as number, 0xcd),
      ),
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

    it("uses a 12-byte IV by default", () => {
      const Crypto = jest.requireMock("react-native-quick-crypto").default
      Crypto.randomBytes.mockClear()

      encryptAesGcm("plaintext", "abcd1234abcd1234abcd1234abcd1234")

      expect(Crypto.randomBytes).toHaveBeenCalledWith(12)
    })

    it("accepts an explicit IV length override", () => {
      const Crypto = jest.requireMock("react-native-quick-crypto").default
      Crypto.randomBytes.mockClear()

      encryptAesGcm("plaintext", "abcd1234abcd1234abcd1234abcd1234", { ivLength: 16 })

      expect(Crypto.randomBytes).toHaveBeenCalledWith(16)
    })
  })

  describe("deriveKeyFromPassword", () => {
    it("returns a 32-char hex key and base64 salt", () => {
      const result = deriveKeyFromPassword("my-secure-password")
      expect(result.key).toHaveLength(32)
      expect(result.key).toMatch(/^[0-9a-f]+$/)
      expect(result.salt.length).toBeGreaterThan(0)
    })

    it("calls pbkdf2Sync with correct params", () => {
      const Crypto = jest.requireMock("react-native-quick-crypto").default
      Crypto.pbkdf2Sync.mockClear()

      deriveKeyFromPassword("test-password")

      expect(Crypto.pbkdf2Sync).toHaveBeenCalledWith(
        "test-password",
        expect.any(Buffer),
        600_000,
        16,
        "SHA-256",
      )
    })

    it("uses provided salt instead of generating one", () => {
      const existingSalt = Buffer.from("existing-salt-16").toString("base64")
      const result = deriveKeyFromPassword("test-password", existingSalt)
      expect(result.salt).toBe(existingSalt)
    })

    it("produces deterministic output with same salt", () => {
      const salt = Buffer.from("fixed-salt-value").toString("base64")
      const result1 = deriveKeyFromPassword("same-password", salt)
      const result2 = deriveKeyFromPassword("same-password", salt)
      expect(result1.key).toBe(result2.key)
      expect(result1.salt).toBe(result2.salt)
    })
  })
})
