import nodeCrypto from "crypto"

jest.mock("react-native-quick-crypto", () => {
  const crypto = jest.requireActual("crypto") as typeof import("crypto")

  return {
    __esModule: true,
    default: {
      randomBytes: crypto.randomBytes,
      pbkdf2Sync: crypto.pbkdf2Sync,
      createCipheriv: crypto.createCipheriv,
      createDecipheriv: crypto.createDecipheriv,
      publicEncrypt: crypto.publicEncrypt,
      constants: crypto.constants,
    },
    Buffer,
  }
})

import {
  decryptAesGcm,
  deriveKeyFromPassword,
  encryptAesGcm,
  encryptRsaOaep,
  generateRandomHexKey,
} from "@app/utils/crypto"

const HEX_KEY = "abcd1234abcd1234abcd1234abcd1234"
const AUTH_TAG_LENGTH = 16

const openWithNode = ({ data, iv, key }: { data: string; iv: string; key: string }) => {
  const raw = Buffer.from(data, "base64")
  const decipher = nodeCrypto.createDecipheriv(
    "aes-128-gcm",
    Buffer.from(key, "hex"),
    Buffer.from(iv, "base64"),
  )
  decipher.setAuthTag(raw.subarray(raw.length - AUTH_TAG_LENGTH))

  return Buffer.concat([
    decipher.update(raw.subarray(0, raw.length - AUTH_TAG_LENGTH)),
    decipher.final(),
  ]).toString("utf8")
}

const sealWithNode = (plainText: string, key: string) => {
  const iv = nodeCrypto.randomBytes(12)
  const cipher = nodeCrypto.createCipheriv("aes-128-gcm", Buffer.from(key, "hex"), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])

  return {
    data: Buffer.concat([encrypted, cipher.getAuthTag()]).toString("base64"),
    iv: iv.toString("base64"),
  }
}

describe("crypto utils", () => {
  describe("generateRandomHexKey", () => {
    it("returns a 32-character hex string", () => {
      expect(generateRandomHexKey()).toMatch(/^[0-9a-f]{32}$/)
    })

    it("generates unique keys", () => {
      expect(generateRandomHexKey()).not.toBe(generateRandomHexKey())
    })
  })

  describe("encryptRsaOaep", () => {
    const { publicKey, privateKey } = nodeCrypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    })

    it("encrypts the base64 form of the key with RSA OAEP over SHA-1", () => {
      const encrypted = encryptRsaOaep(publicKey, HEX_KEY)

      const decrypted = nodeCrypto.privateDecrypt(
        {
          key: privateKey,
          padding: nodeCrypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha1",
        },
        Buffer.from(encrypted, "base64"),
      )

      expect(decrypted.toString("utf-8")).toBe(
        Buffer.from(HEX_KEY, "hex").toString("base64"),
      )
    })
  })

  describe("encryptAesGcm", () => {
    it("seals with AES-128-GCM so the ciphertext opens with the same key and IV", () => {
      const encrypted = encryptAesGcm("plaintext", HEX_KEY)

      expect(openWithNode({ ...encrypted, key: HEX_KEY })).toBe("plaintext")
    })

    it("uses a 12-byte IV by default", () => {
      const { iv } = encryptAesGcm("plaintext", HEX_KEY)

      expect(Buffer.from(iv, "base64")).toHaveLength(12)
    })

    it("accepts an explicit IV length override", () => {
      const encrypted = encryptAesGcm("plaintext", HEX_KEY, { ivLength: 16 })

      expect(Buffer.from(encrypted.iv, "base64")).toHaveLength(16)
      expect(openWithNode({ ...encrypted, key: HEX_KEY })).toBe("plaintext")
    })
  })

  describe("decryptAesGcm", () => {
    it("opens data sealed with AES-128-GCM outside the app", () => {
      const sealed = sealWithNode("4549880051539745", HEX_KEY)

      expect(decryptAesGcm({ ...sealed, key: HEX_KEY })).toBe("4549880051539745")
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
    it("returns a 32-char hex key and a fresh 16-byte salt", () => {
      const result = deriveKeyFromPassword("my-secure-password")

      expect(result.key).toMatch(/^[0-9a-f]{32}$/)
      expect(Buffer.from(result.salt, "base64")).toHaveLength(16)
    })

    it("draws a new salt on every call", () => {
      expect(deriveKeyFromPassword("same-password").salt).not.toBe(
        deriveKeyFromPassword("same-password").salt,
      )
    })

    it("derives the key with 600k rounds of SHA-256 over the given salt", () => {
      const salt = Buffer.from("fixed-salt-value").toString("base64")
      const expectedKey = nodeCrypto
        .pbkdf2Sync("test-password", Buffer.from(salt, "base64"), 600_000, 16, "sha256")
        .toString("hex")

      expect(deriveKeyFromPassword("test-password", salt)).toEqual({
        key: expectedKey,
        salt,
      })
    })
  })
})
