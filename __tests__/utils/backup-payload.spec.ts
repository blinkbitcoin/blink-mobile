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
  BackupPayloadError,
  BackupPayloadErrorReason,
  buildBackupPayload,
  isEncryptedBackup,
  parseBackupMetadata,
  parseBackupPayload,
  parseEncryptedBackupPayload,
} from "@app/utils/backup-payload"

describe("spark backup format", () => {
  const mnemonic =
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain"
  const walletIdentifier =
    "02abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567"
  const lightningAddress = "alice@example.com"

  it("builds and parses an unencrypted payload", () => {
    const raw = buildBackupPayload(mnemonic, { walletIdentifier })

    expect(parseBackupPayload(raw)).toEqual({ mnemonic })
  })

  it("builds and parses an encrypted payload", () => {
    const raw = buildBackupPayload(mnemonic, {
      walletIdentifier,
      password: "ValidPass1234!",
    })

    expect(parseEncryptedBackupPayload(raw, "ValidPass1234!")).toEqual({ mnemonic })
  })

  it("persists cipher and kdf parameters for encrypted payloads", () => {
    const raw = buildBackupPayload(mnemonic, {
      walletIdentifier,
      password: "ValidPass1234!",
    })
    const payload = JSON.parse(raw) as {
      encrypted: boolean
      cipher: string
      kdf: { name: string; iterations: number; digest: string; keyLen: number }
    }

    expect(payload.encrypted).toBe(true)
    expect(payload.cipher).toBe("AES-128-GCM")
    expect(payload.kdf).toEqual({
      name: "PBKDF2",
      iterations: 600_000,
      digest: "SHA-256",
      keyLen: 16,
    })
  })

  it("stores a 12-byte IV for encrypted payloads", () => {
    const raw = buildBackupPayload(mnemonic, {
      walletIdentifier,
      password: "ValidPass1234!",
    })
    const payload = JSON.parse(raw) as { iv: string }

    expect(Buffer.from(payload.iv, "base64")).toHaveLength(12)
  })

  it("throws BackupPayloadError with reason='wrong-password' on AES-GCM auth tag mismatch (Critical #10)", () => {
    const raw = buildBackupPayload(mnemonic, {
      walletIdentifier,
      password: "ValidPass1234!",
    })

    expect(() => parseEncryptedBackupPayload(raw, "WrongPassword!1")).toThrow(
      BackupPayloadError,
    )
    try {
      parseEncryptedBackupPayload(raw, "WrongPassword!1")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.WrongPassword,
      )
    }
  })

  it("throws BackupPayloadError with reason='missing-crypto-fields' and names the salt field when salt is absent (Critical #10)", () => {
    const raw = JSON.stringify({
      version: 1,
      walletIdentifier,
      createdAt: 1,
      encrypted: true,
      cipher: "AES-128-GCM",
      kdf: {
        name: "PBKDF2",
        iterations: 600_000,
        digest: "SHA-256",
        keyLen: 16,
      },
      data: "ZW5jcnlwdGVk",
      iv: "aXY=",
    })

    try {
      parseEncryptedBackupPayload(raw, "anyPassword")
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.MissingCryptoFields,
      )
      expect((err as BackupPayloadError).message).toContain("salt")
    }
  })

  it("throws BackupPayloadError with reason='missing-crypto-fields' and names the iv field when iv is empty (Critical #10)", () => {
    const raw = JSON.stringify({
      version: 1,
      walletIdentifier,
      createdAt: 1,
      encrypted: true,
      cipher: "AES-128-GCM",
      data: "ZW5jcnlwdGVk",
      iv: "",
      salt: "c2FsdA==",
    })

    try {
      parseEncryptedBackupPayload(raw, "anyPassword")
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.MissingCryptoFields,
      )
      expect((err as BackupPayloadError).message).toContain("iv")
    }
  })

  it("throws BackupPayloadError with reason='missing-crypto-fields' and names the data field when data is absent (Critical #10)", () => {
    const raw = JSON.stringify({
      version: 1,
      walletIdentifier,
      createdAt: 1,
      encrypted: true,
      cipher: "AES-128-GCM",
      iv: "aXY=",
      salt: "c2FsdA==",
    })

    try {
      parseEncryptedBackupPayload(raw, "anyPassword")
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.MissingCryptoFields,
      )
      expect((err as BackupPayloadError).message).toContain("data")
    }
  })

  it("throws BackupPayloadError with reason='unsupported-cipher' on unknown cipher (Critical #10)", () => {
    const raw = JSON.stringify({
      version: 1,
      walletIdentifier,
      createdAt: 1,
      encrypted: true,
      cipher: "AES-256-CBC",
      data: "ZW5jcnlwdGVk",
      iv: "aXY=",
      salt: "c2FsdA==",
    })

    try {
      parseEncryptedBackupPayload(raw, "anyPassword")
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.UnsupportedCipher,
      )
    }
  })

  it("throws BackupPayloadError with reason='invalid-mnemonic' when plain payload has empty mnemonic (Critical #10)", () => {
    const raw = JSON.stringify({
      version: 1,
      walletIdentifier,
      createdAt: 1,
      encrypted: false,
      mnemonic: "",
    })

    try {
      parseBackupPayload(raw)
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.InvalidMnemonic,
      )
    }
  })

  it("throws BackupPayloadError with reason='invalid-mnemonic' when plain payload has no mnemonic field (Critical #10)", () => {
    const raw = JSON.stringify({
      version: 1,
      walletIdentifier,
      createdAt: 1,
      encrypted: false,
    })

    try {
      parseBackupPayload(raw)
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.InvalidMnemonic,
      )
    }
  })

  it("throws BackupPayloadError with reason='invalid-mnemonic' when plain payload has non-string mnemonic (Critical #10)", () => {
    const raw = JSON.stringify({
      version: 1,
      walletIdentifier,
      createdAt: 1,
      encrypted: false,
      mnemonic: 42,
    })

    try {
      parseBackupPayload(raw)
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.InvalidMnemonic,
      )
    }
  })

  it("produces different encrypted payload content across runs", () => {
    const first = JSON.parse(
      buildBackupPayload(mnemonic, { walletIdentifier, password: "ValidPass1234!" }),
    ) as {
      data: string
      iv: string
    }
    const second = JSON.parse(
      buildBackupPayload(mnemonic, { walletIdentifier, password: "ValidPass1234!" }),
    ) as {
      data: string
      iv: string
    }

    expect(first.data).not.toBe(second.data)
    expect(first.iv).not.toBe(second.iv)
  })

  it("isEncryptedBackup returns true for encrypted payloads", () => {
    const raw = buildBackupPayload(mnemonic, {
      walletIdentifier,
      password: "ValidPass1234!",
    })
    expect(isEncryptedBackup(raw)).toBe(true)
  })

  it("isEncryptedBackup returns false for unencrypted payloads", () => {
    const raw = buildBackupPayload(mnemonic, { walletIdentifier })
    expect(isEncryptedBackup(raw)).toBe(false)
  })

  it("isEncryptedBackup returns false for invalid JSON", () => {
    expect(isEncryptedBackup("not json {{{")).toBe(false)
  })

  it("parseBackupPayload throws BackupPayloadError with reason='encrypted-requires-password' on encrypted payload (Critical #10)", () => {
    const raw = buildBackupPayload(mnemonic, {
      walletIdentifier,
      password: "ValidPass1234!",
    })

    try {
      parseBackupPayload(raw)
      throw new Error("should have thrown")
    } catch (err) {
      expect(err).toBeInstanceOf(BackupPayloadError)
      expect((err as BackupPayloadError).reason).toBe(
        BackupPayloadErrorReason.EncryptedRequiresPassword,
      )
    }
  })

  it("parseEncryptedBackupPayload handles unencrypted payload", () => {
    const raw = buildBackupPayload(mnemonic, { walletIdentifier })
    expect(parseEncryptedBackupPayload(raw, "anything")).toEqual({ mnemonic })
  })

  it("matches the app payload shape with standards-compliant AES-GCM output", () => {
    const raw = buildBackupPayload(mnemonic, {
      walletIdentifier,
      password: "ValidPass1234!",
    })
    const payload = JSON.parse(raw) as { iv: string; data: string; salt: string }

    const key = nodeCrypto.pbkdf2Sync(
      "ValidPass1234!",
      Buffer.from(payload.salt, "base64"),
      600_000,
      16,
      "sha256",
    )
    const iv = Buffer.from(payload.iv, "base64")
    const encrypted = Buffer.from(payload.data, "base64")
    const ciphertext = encrypted.subarray(0, encrypted.length - 16)
    const authTag = encrypted.subarray(encrypted.length - 16)
    const decipher = nodeCrypto.createDecipheriv("aes-128-gcm", key, iv)
    decipher.setAuthTag(authTag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8")

    expect(decrypted).toBe(mnemonic)
  })

  describe("metadata", () => {
    it("includes walletIdentifier and version in encrypted payloads", () => {
      const raw = buildBackupPayload(mnemonic, {
        walletIdentifier,
        password: "ValidPass1234!",
      })
      const payload = JSON.parse(raw) as {
        version: number
        walletIdentifier: string
        createdAt: number
      }

      expect(payload.version).toBe(1)
      expect(payload.walletIdentifier).toBe(walletIdentifier)
      expect(typeof payload.createdAt).toBe("number")
    })

    it("includes walletIdentifier in unencrypted payloads", () => {
      const raw = buildBackupPayload(mnemonic, { walletIdentifier })
      const payload = JSON.parse(raw) as { walletIdentifier: string }

      expect(payload.walletIdentifier).toBe(walletIdentifier)
    })

    it("persists lightningAddress when provided", () => {
      const raw = buildBackupPayload(mnemonic, { walletIdentifier, lightningAddress })
      const payload = JSON.parse(raw) as { lightningAddress?: string }

      expect(payload.lightningAddress).toBe(lightningAddress)
    })

    it("omits lightningAddress when not provided", () => {
      const raw = buildBackupPayload(mnemonic, { walletIdentifier })
      const payload = JSON.parse(raw) as { lightningAddress?: string }

      expect(payload.lightningAddress).toBeUndefined()
    })

    it("parseBackupMetadata extracts metadata from unencrypted payload", () => {
      const raw = buildBackupPayload(mnemonic, { walletIdentifier, lightningAddress })

      expect(parseBackupMetadata(raw)).toEqual({
        version: 1,
        walletIdentifier,
        lightningAddress,
        createdAt: expect.any(Number),
        encrypted: false,
      })
    })

    it("parseBackupMetadata extracts metadata from encrypted payload without decrypting", () => {
      const raw = buildBackupPayload(mnemonic, {
        walletIdentifier,
        lightningAddress,
        password: "ValidPass1234!",
      })

      expect(parseBackupMetadata(raw)).toEqual({
        version: 1,
        walletIdentifier,
        lightningAddress,
        createdAt: expect.any(Number),
        encrypted: true,
      })
    })

    it("parseBackupMetadata returns null for invalid JSON", () => {
      expect(parseBackupMetadata("not json {{{")).toBeNull()
    })

    it("parseBackupMetadata returns null when walletIdentifier is missing", () => {
      const raw = JSON.stringify({ version: 1, mnemonic, encrypted: false })

      expect(parseBackupMetadata(raw)).toBeNull()
    })
  })
})
