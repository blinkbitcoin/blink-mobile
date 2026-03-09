const PIN_LENGTH = 4
const PIN_BLOCK_LENGTH = 16
const ISO_9564_FORMAT_2 = "2"

/** Formats a PIN into an ISO 9564-1 Format 2 block: `2[length_hex][PIN][F-padding]` */
export const formatPinBlock = (pin: string): string => {
  if (pin.length !== PIN_LENGTH) {
    throw new Error(`PIN must be exactly ${PIN_LENGTH} digits`)
  }

  const header = `${ISO_9564_FORMAT_2}${pin.length.toString(16)}`
  const block = `${header}${pin}`
  return block.padEnd(PIN_BLOCK_LENGTH, "F")
}
