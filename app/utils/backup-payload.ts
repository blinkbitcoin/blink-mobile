import {
  PBKDF2_DIGEST,
  PBKDF2_ITERATIONS,
  PBKDF2_KEY_LENGTH,
  decryptAesGcm,
  deriveKeyFromPassword,
  encryptAesGcm,
} from "./crypto"

type BaseBackupPayload = {
  version: number
  walletIdentifier: string
  lightningAddress?: string
  createdAt: number
}

type PlainBackupPayload = BaseBackupPayload & {
  encrypted: false
  mnemonic: string
}

type EncryptedBackupPayload = BaseBackupPayload & {
  encrypted: true
  kdf: typeof KDF_PARAMS
  cipher: typeof CIPHER
  data: string
  iv: string
  salt: string
}

export type BackupPayload = PlainBackupPayload | EncryptedBackupPayload

export type BackupMetadata = {
  version: number
  walletIdentifier: string
  lightningAddress?: string
  createdAt: number
  encrypted: boolean
}

type BuildOptions = {
  walletIdentifier: string
  lightningAddress?: string
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

const buildBase = ({
  walletIdentifier,
  lightningAddress,
  version,
}: {
  walletIdentifier: string
  lightningAddress?: string
  version: number
}): BaseBackupPayload => {
  const base: BaseBackupPayload = {
    version,
    walletIdentifier,
    createdAt: Date.now(),
  }
  if (lightningAddress) base.lightningAddress = lightningAddress
  return base
}

export const buildBackupPayload = (mnemonic: string, opts: BuildOptions): string => {
  const { walletIdentifier, lightningAddress, password, version = CURRENT_VERSION } = opts
  const base = buildBase({ walletIdentifier, lightningAddress, version })

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

export const isEncryptedBackup = (raw: string): boolean => {
  try {
    const parsed = JSON.parse(raw)
    return parsed?.encrypted === true
  } catch {
    return false
  }
}

export const parseBackupMetadata = (raw: string): BackupMetadata | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<BackupPayload>
    if (typeof parsed.walletIdentifier !== "string" || !parsed.walletIdentifier) {
      return null
    }
    return {
      version: typeof parsed.version === "number" ? parsed.version : 0,
      walletIdentifier: parsed.walletIdentifier,
      lightningAddress: parsed.lightningAddress,
      createdAt: typeof parsed.createdAt === "number" ? parsed.createdAt : 0,
      encrypted: parsed.encrypted === true,
    }
  } catch {
    return null
  }
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
