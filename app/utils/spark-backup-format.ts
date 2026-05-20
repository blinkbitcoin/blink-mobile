import {
  PBKDF2_DIGEST,
  PBKDF2_ITERATIONS,
  PBKDF2_KEY_LENGTH,
  decryptAesGcm,
  deriveKeyFromPassword,
  encryptAesGcm,
} from "./crypto"

type PlainBackupPayload = {
  version: number
  createdAt: number
  encrypted: false
  mnemonic: string
}

type EncryptedBackupPayload = {
  version: number
  createdAt: number
  encrypted: true
  kdf: typeof KDF_PARAMS
  cipher: typeof CIPHER
  data: string
  iv: string
  salt: string
}

export type BackupPayload = PlainBackupPayload | EncryptedBackupPayload

type BuildOptions = {
  password?: string
  version?: number
}

const CURRENT_VERSION = 1
const GCM_IV_LENGTH = 12
const CIPHER = "AES-128-GCM" as const

const KDF_PARAMS = {
  name: "PBKDF2",
  iterations: PBKDF2_ITERATIONS,
  digest: PBKDF2_DIGEST,
  keyLen: PBKDF2_KEY_LENGTH,
} as const

export const buildBackupPayload = (mnemonic: string, opts: BuildOptions = {}): string => {
  const { password, version = CURRENT_VERSION } = opts
  const base = { version, createdAt: Date.now() }

  if (!password) {
    const payload: PlainBackupPayload = { ...base, encrypted: false, mnemonic }
    return JSON.stringify(payload)
  }

  const { key, salt } = deriveKeyFromPassword(password)
  const { data, iv } = encryptAesGcm(mnemonic, key, { ivLength: GCM_IV_LENGTH })

  const payload: EncryptedBackupPayload = {
    ...base,
    encrypted: true,
    kdf: KDF_PARAMS,
    cipher: CIPHER,
    data,
    iv,
    salt,
  }
  return JSON.stringify(payload)
}

export const parseBackupPayload = (raw: string): { mnemonic: string } => {
  const parsed = JSON.parse(raw) as BackupPayload

  if (!parsed.encrypted) {
    return { mnemonic: parsed.mnemonic }
  }

  throw new Error("Encrypted payload requires password — use parseEncryptedBackupPayload")
}

export const parseEncryptedBackupPayload = (
  raw: string,
  password: string,
): { mnemonic: string } => {
  const parsed = JSON.parse(raw) as BackupPayload

  if (!parsed.encrypted) {
    return { mnemonic: parsed.mnemonic }
  }

  const { key } = deriveKeyFromPassword(password, parsed.salt)
  const mnemonic = decryptAesGcm({ data: parsed.data, key, iv: parsed.iv })
  return { mnemonic }
}
