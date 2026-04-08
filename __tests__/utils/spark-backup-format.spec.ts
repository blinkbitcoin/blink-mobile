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
  buildBackupPayload,
  parseBackupPayload,
  parseEncryptedBackupPayload,
} from "@app/utils/spark-backup-format"

describe("spark backup format", () => {
  const mnemonic =
    "youth indicate void nation bundle execute ritual artwork harvest genuine plunge captain"

  it("builds and parses an unencrypted payload", () => {
    const raw = buildBackupPayload(mnemonic)

    expect(parseBackupPayload(raw)).toEqual({ mnemonic })
  })

  it("builds and parses an encrypted payload", () => {
    const raw = buildBackupPayload(mnemonic, { password: "ValidPass1234!" })

    expect(parseEncryptedBackupPayload(raw, "ValidPass1234!")).toEqual({ mnemonic })
  })

  it("persists cipher and kdf parameters for encrypted payloads", () => {
    const raw = buildBackupPayload(mnemonic, { password: "ValidPass1234!" })
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
    const raw = buildBackupPayload(mnemonic, { password: "ValidPass1234!" })
    const payload = JSON.parse(raw) as { iv: string }

    expect(Buffer.from(payload.iv, "base64")).toHaveLength(12)
  })

  it("fails to decrypt encrypted payload with wrong password", () => {
    const raw = buildBackupPayload(mnemonic, { password: "ValidPass1234!" })

    expect(() => parseEncryptedBackupPayload(raw, "WrongPassword!1")).toThrow()
  })

  it("produces different encrypted payload content across runs", () => {
    const first = JSON.parse(
      buildBackupPayload(mnemonic, { password: "ValidPass1234!" }),
    ) as {
      data: string
      iv: string
    }
    const second = JSON.parse(
      buildBackupPayload(mnemonic, { password: "ValidPass1234!" }),
    ) as {
      data: string
      iv: string
    }

    expect(first.data).not.toBe(second.data)
    expect(first.iv).not.toBe(second.iv)
  })

  it("matches the app payload shape with standards-compliant AES-GCM output", () => {
    const raw = buildBackupPayload(mnemonic, { password: "ValidPass1234!" })
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
})
