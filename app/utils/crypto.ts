import Crypto, { Buffer as CryptoBuffer } from "react-native-quick-crypto"

type EncryptOptions = {
  ivLength?: number
}

type DecryptParams = {
  data: string
  key: string
  iv: string
  authTagLength?: number
}

export const PBKDF2_ITERATIONS = 600_000
export const PBKDF2_KEY_LENGTH = 16
export const PBKDF2_DIGEST = "SHA-256"

const DEFAULT_IV_LENGTH = 12
const DEFAULT_AUTH_TAG_LENGTH = 16

export const deriveKeyFromPassword = (
  password: string,
  existingSalt?: string,
): { key: string; salt: string } => {
  const salt = existingSalt ? Buffer.from(existingSalt, "base64") : Crypto.randomBytes(16)

  const key = Crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    PBKDF2_KEY_LENGTH,
    PBKDF2_DIGEST,
  )

  return {
    key: key.toString("hex"),
    salt: salt.toString("base64"),
  }
}

export const generateRandomHexKey = (): string => Crypto.randomBytes(16).toString("hex")

export const encryptRsaOaep = (publicKeyPem: string, hexData: string): string => {
  const dataBase64 = Buffer.from(hexData, "hex").toString("base64")

  const encrypted = Crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: Crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha1",
    },
    Buffer.from(dataBase64, "utf-8"),
  )

  return encrypted.toString("base64")
}

export const encryptAesGcm = (
  plainText: string,
  hexKey: string,
  options: EncryptOptions = {},
): { data: string; iv: string } => {
  const { ivLength = DEFAULT_IV_LENGTH } = options
  const iv = Crypto.randomBytes(ivLength)
  const key = Buffer.from(hexKey, "hex")

  const cipher = Crypto.createCipheriv("aes-128-gcm", Uint8Array.from(key), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    data: Buffer.concat([Uint8Array.from(encrypted), Uint8Array.from(authTag)]).toString(
      "base64",
    ),
    iv: iv.toString("base64"),
  }
}

export const decryptAesGcm = (params: DecryptParams): string => {
  const { authTagLength = DEFAULT_AUTH_TAG_LENGTH } = params
  const key = Buffer.from(params.key, "hex")
  const iv = Buffer.from(params.iv, "base64")
  const raw = Buffer.from(params.data, "base64")

  const ciphertext = raw.subarray(0, raw.length - authTagLength)
  const authTag = raw.subarray(raw.length - authTagLength)

  const decipher = Crypto.createDecipheriv("aes-128-gcm", Uint8Array.from(key), iv)
  decipher.setAuthTag(CryptoBuffer.from(new Uint8Array(authTag)))

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
