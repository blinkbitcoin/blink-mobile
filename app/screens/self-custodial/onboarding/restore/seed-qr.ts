/* eslint-disable no-bitwise -- the QR data bitstream is shifted by half a byte */
import { entropyToMnemonic, validateMnemonic, wordlists } from "bip39"

/** SeedQR (SeedSigner spec): a BIP39 phrase as a QR code, decoded on the device only.
 *  Standard SeedQR is numeric: each word's wordlist index as four digits. CompactSeedQR
 *  is binary: the phrase's raw entropy, with the checksum word recomputed on decode. */

export const SeedQrStatus = {
  Ok: "ok",
  Invalid: "invalid",
  Only12Words: "only12Words",
  NotSeedQr: "notSeedQr",
  Unreadable: "unreadable",
} as const

export type SeedQrStatus = (typeof SeedQrStatus)[keyof typeof SeedQrStatus]

export type SeedQrResult =
  | { status: typeof SeedQrStatus.Ok; words: string[] }
  | { status: Exclude<SeedQrStatus, typeof SeedQrStatus.Ok> }

const WORDLIST = wordlists.english
const DIGITS_PER_WORD = 4
const STANDARD_12_LENGTH = 12 * DIGITS_PER_WORD
const STANDARD_24_LENGTH = 24 * DIGITS_PER_WORD
const COMPACT_12_BYTES = 16
const COMPACT_24_BYTES = 32
const QR_BYTE_MODE = 0b0100

const decodeStandard = (digits: string): SeedQrResult => {
  if (digits.length === STANDARD_24_LENGTH) return { status: SeedQrStatus.Only12Words }
  if (digits.length !== STANDARD_12_LENGTH) return { status: SeedQrStatus.NotSeedQr }

  const words: string[] = []
  for (let i = 0; i < digits.length; i += DIGITS_PER_WORD) {
    const word = WORDLIST[Number(digits.slice(i, i + DIGITS_PER_WORD))]
    if (!word) return { status: SeedQrStatus.Invalid }
    words.push(word)
  }
  return validateMnemonic(words.join(" "))
    ? { status: SeedQrStatus.Ok, words }
    : { status: SeedQrStatus.Invalid }
}

const PRINTABLE_ASCII_MIN = 0x20
const PRINTABLE_ASCII_MAX = 0x7e

/** A CompactSeedQR is random entropy; 16 random bytes are all printable text about once
 *  in 7.5 million. A text code of the same length (a 16-character URL) is far likelier,
 *  and must not come out as somebody's seed.
 *  No bytes is no text: entropy starting 40 00 reads as an empty byte-mode payload. */
const isPrintableText = (bytes: Uint8Array): boolean =>
  bytes.length > 0 &&
  bytes.every((byte) => byte >= PRINTABLE_ASCII_MIN && byte <= PRINTABLE_ASCII_MAX)

const decodeCompact = (entropy: Uint8Array): SeedQrResult | null => {
  if (isPrintableText(entropy)) return null
  if (entropy.length === COMPACT_24_BYTES) return { status: SeedQrStatus.Only12Words }
  if (entropy.length !== COMPACT_12_BYTES) return null
  const mnemonic = entropyToMnemonic(Buffer.from(entropy).toString("hex"), WORDLIST)
  return { status: SeedQrStatus.Ok, words: mnemonic.split(" ") }
}

/** Some scanners hand back the QR's data bitstream rather than the decoded bytes: a
 *  4-bit mode, an 8-bit length (byte mode, versions 1-9), then the bytes, all shifted
 *  by half a byte. Which one a platform returns is what the test build has to show,
 *  so both shapes are tried. */
const bytesFromBitstream = (raw: Uint8Array): Uint8Array | null => {
  if (raw.length < 2 || raw[0] >> 4 !== QR_BYTE_MODE) return null
  const count = ((raw[0] & 0x0f) << 4) | (raw[1] >> 4)
  if (raw.length < count + 2) return null
  const bytes = new Uint8Array(count)
  for (let i = 0; i < count; i += 1) {
    bytes[i] = ((raw[1 + i] & 0x0f) << 4) | (raw[2 + i] >> 4)
  }
  return bytes
}

// eslint-disable-next-line no-control-regex
const NON_PRINTABLE = /[\u0000-\u0008\u000e-\u001f\u007f-\u009f�]/

/** Never logs, reports or returns the payload on a rejection: the caller only learns
 *  which kind of code it was. */
export const decodeSeedQr = ({
  text,
  rawBytes,
}: {
  text?: string
  rawBytes?: Uint8Array
}): SeedQrResult => {
  if (text && /^\d+$/.test(text)) return decodeStandard(text)

  // A CompactSeedQR has no readable text. A URL, invoice or address must not be
  // recovered from its raw bytes: those can be 16 bytes and otherwise look like entropy.
  if (text && !NON_PRINTABLE.test(text)) return { status: SeedQrStatus.NotSeedQr }

  if (rawBytes) {
    const bitstream = bytesFromBitstream(rawBytes)
    // Byte-mode packaging of a text payload. Do not treat that packaging as entropy.
    if (bitstream && isPrintableText(bitstream)) return { status: SeedQrStatus.NotSeedQr }

    for (const candidate of [rawBytes, bitstream]) {
      const result = candidate && decodeCompact(candidate)
      if (result) return result
    }
  }

  // Binary content the scanner could only hand back as text: likely a CompactSeedQR
  // whose bytes were lost on the way, not a code of some other kind.
  if (text && NON_PRINTABLE.test(text)) return { status: SeedQrStatus.Unreadable }
  return { status: SeedQrStatus.NotSeedQr }
}
