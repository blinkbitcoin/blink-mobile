import Crypto from "react-native-quick-crypto"

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

export const decryptAesGcm = (
  cipherData: string,
  ivBase64: string,
  hexKey: string,
): string => {
  const key = Buffer.from(hexKey, "hex")
  const iv = Buffer.from(ivBase64, "base64")
  const raw = Buffer.from(cipherData, "base64")

  const authTagLength = 16
  const encrypted = raw.subarray(0, raw.length - authTagLength)
  const authTag = raw.subarray(raw.length - authTagLength)

  const decipher = Crypto.createDecipheriv("aes-128-gcm", Uint8Array.from(key), iv)
  decipher.setAuthTag(authTag as never)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}

export const encryptAesGcm = (
  plainText: string,
  hexKey: string,
): { data: string; iv: string } => {
  const iv = Crypto.randomBytes(16)
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
