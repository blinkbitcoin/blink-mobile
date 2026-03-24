import crypto from "crypto"

import { generateRandomHexKey, encryptAesGcm, decryptAesGcm } from "@app/utils/crypto"

jest.mock("react-native-quick-crypto", () => ({
  __esModule: true,
  default: {
    randomBytes: (size: number) => crypto.randomBytes(size),
    publicEncrypt: crypto.publicEncrypt,
    createCipheriv: crypto.createCipheriv,
    createDecipheriv: crypto.createDecipheriv,
    constants: crypto.constants,
  },
}))

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

  describe("encryptAesGcm + decryptAesGcm roundtrip", () => {
    it("encrypts and decrypts a simple string", () => {
      const key = generateRandomHexKey()
      const plaintext = "hello world"

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm(data, iv, key)

      expect(decrypted).toBe(plaintext)
    })

    it("encrypts and decrypts an empty string", () => {
      const key = generateRandomHexKey()
      const plaintext = ""

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm(data, iv, key)

      expect(decrypted).toBe(plaintext)
    })

    it("encrypts and decrypts unicode text", () => {
      const key = generateRandomHexKey()
      const plaintext = "café ñ 日本語 🚀"

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm(data, iv, key)

      expect(decrypted).toBe(plaintext)
    })

    it("encrypts and decrypts a long string", () => {
      const key = generateRandomHexKey()
      const plaintext = "a]".repeat(10000)

      const { data, iv } = encryptAesGcm(plaintext, key)
      const decrypted = decryptAesGcm(data, iv, key)

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

      expect(() => decryptAesGcm(data, iv, key2)).toThrow()
    })

    it("fails to decrypt with tampered ciphertext", () => {
      const key = generateRandomHexKey()
      const plaintext = "secret"

      const { data, iv } = encryptAesGcm(plaintext, key)

      const tampered = Buffer.from(data, "base64")
      tampered[0] = tampered[0] === 0 ? 1 : 0
      const tamperedData = tampered.toString("base64")

      expect(() => decryptAesGcm(tamperedData, iv, key)).toThrow()
    })

    it("decrypts a card number correctly", () => {
      const key = generateRandomHexKey()
      const pan = "4549880051539745"

      const { data, iv } = encryptAesGcm(pan, key)
      const decrypted = decryptAesGcm(data, iv, key)

      expect(decrypted).toBe(pan)
    })

    it("decrypts a CVC correctly", () => {
      const key = generateRandomHexKey()
      const cvc = "342"

      const { data, iv } = encryptAesGcm(cvc, key)
      const decrypted = decryptAesGcm(data, iv, key)

      expect(decrypted).toBe(cvc)
    })
  })
})
