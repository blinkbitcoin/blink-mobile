import {
  generateRandomHexKey,
  encryptRsaOaep,
  encryptAesGcm,
  decryptAesGcm,
  deriveKeyFromPassword,
} from "@app/utils/crypto"

/** AES-GCM runs on Node's real crypto so encrypt/decrypt roundtrip for real; the
 *  wrappers stay jest.fn so the call-shape assertions below can still inspect them.
 *  RSA and PBKDF2 keep deterministic stubs: the test key is not a real PEM, and
 *  600k PBKDF2 rounds per test would only slow the suite down. */
jest.mock("react-native-quick-crypto", () => {
  const nodeCrypto = jest.requireActual<typeof import("crypto")>("crypto")

  return {
    __esModule: true,
    Buffer,
    default: {
      randomBytes: jest.fn((size: number) => nodeCrypto.randomBytes(size)),
      publicEncrypt: jest.fn().mockReturnValue(Buffer.from("rsa-encrypted-data")),
      createCipheriv: jest.fn(nodeCrypto.createCipheriv),
      createDecipheriv: jest.fn(nodeCrypto.createDecipheriv),
      pbkdf2Sync: jest.fn((...args: readonly unknown[]) =>
        Buffer.alloc(args[3] as number, 0xcd),
      ),
      constants: nodeCrypto.constants,
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

    it("generates unique keys", () => {
      const key1 = generateRandomHexKey()
      const key2 = generateRandomHexKey()
      expect(key1).not.toBe(key2)
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

  describe("encryptAesGcm + decryptAesGcm roundtrip", () => {
    it("encrypts and decrypts a simple string", () => {
      const key = generateRandomHexKey()
      const plaintext = "hello world"

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm({ data, iv, key })

      expect(decrypted).toBe(plaintext)
    })

    it("encrypts and decrypts an empty string", () => {
      const key = generateRandomHexKey()
      const plaintext = ""

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm({ data, iv, key })

      expect(decrypted).toBe(plaintext)
    })

    it("encrypts and decrypts unicode text", () => {
      const key = generateRandomHexKey()
      const plaintext = "café ñ 日本語 🚀"

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm({ data, iv, key })

      expect(decrypted).toBe(plaintext)
    })

    it("encrypts and decrypts a long string", () => {
      const key = generateRandomHexKey()
      const plaintext = "a]".repeat(10000)

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm({ data, iv, key })

      expect(decrypted).toBe(plaintext)
    })

    it("produces different ciphertext for same plaintext", () => {
      const key = generateRandomHexKey()
      const plaintext = "same input"

      const result1 = encryptAesGcm(plaintext, key)
      const result2 = encryptAesGcm(plaintext, key)

      expect(result1.data).not.toBe(result2.data)
      expect(result1.iv).not.toBe(result2.iv)
    })

    it("fails to decrypt with wrong key", () => {
      const key1 = generateRandomHexKey()
      const key2 = generateRandomHexKey()
      const plaintext = "secret"

      const { data, iv } = encryptAesGcm(plaintext, key1)

      expect(() => decryptAesGcm({ data, iv, key: key2 })).toThrow()
    })

    it("fails to decrypt with tampered ciphertext", () => {
      const key = generateRandomHexKey()
      const plaintext = "secret"

      const { data, iv } = encryptAesGcm(plaintext, key)

      const tampered = Buffer.from(data, "base64")
      tampered[0] = tampered[0] === 0 ? 1 : 0
      const tamperedData = tampered.toString("base64")

      expect(() => decryptAesGcm({ data: tamperedData, iv, key })).toThrow()
    })

    it("decrypts a card number correctly", () => {
      const key = generateRandomHexKey()
      const pan = "4549880051539745"

      const { data, iv } = encryptAesGcm(pan, key)
      const decrypted = decryptAesGcm({ data, iv, key })

      expect(decrypted).toBe(pan)
    })

    it("decrypts a CVC correctly", () => {
      const key = generateRandomHexKey()
      const cvc = "342"

      const { data, iv } = encryptAesGcm(cvc, key)
      const decrypted = decryptAesGcm({ data, iv, key })

      expect(decrypted).toBe(cvc)
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
