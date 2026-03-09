const PIN_BLOCK_LENGTH = 16
const ISO_9564_FORMAT_2 = "2"

export const formatPinBlock = (pin: string): string => {
  const header = `${ISO_9564_FORMAT_2}${pin.length.toString(16)}`
  const block = `${header}${pin}`
  return block.padEnd(PIN_BLOCK_LENGTH, "F")
}
