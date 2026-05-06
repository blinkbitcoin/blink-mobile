import { encryptAesGcm, encryptRsaOaep, generateRandomHexKey } from "@app/utils/crypto"

import { formatPinBlock } from "./format-pin-block"

export const encryptPin = (
  pin: string,
  publicKeyPem: string,
): { encryptedPin: string; iv: string; sessionId: string } => {
  const secretKey = generateRandomHexKey()
  const sessionId = encryptRsaOaep(publicKeyPem, secretKey)
  const pinBlock = formatPinBlock(pin)
  const { data: encryptedPin, iv } = encryptAesGcm(pinBlock, secretKey, { ivLength: 16 })

  return { encryptedPin, iv, sessionId }
}
