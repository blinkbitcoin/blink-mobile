import { entropyToMnemonic, mnemonicToEntropy, wordlists } from "bip39"

import {
  decodeSeedQr,
  SeedQrStatus,
} from "@app/screens/self-custodial/onboarding/restore/seed-qr"

const WORDLIST = wordlists.english

/** Public test phrases from BIP39 tooling: never hold funds. */
const PHRASE_12 =
  "attack pizza motion avocado network gather crop fresh patrol unusual wild holiday"
const PHRASE_24 = `${"abandon ".repeat(23)}art`

const standardDigits = (phrase: string) =>
  phrase
    .split(" ")
    .map((word) => String(WORDLIST.indexOf(word)).padStart(4, "0"))
    .join("")

const compactBytes = (phrase: string) =>
  Uint8Array.from(Buffer.from(mnemonicToEntropy(phrase), "hex"))

/** The QR data bitstream for a byte-mode payload: 4-bit mode, 8-bit length, the bytes,
 *  then a terminator, as some scanners hand it back. */
const byteModeBitstream = (payload: Uint8Array) => {
  const bits = [
    "0100",
    payload.length.toString(2).padStart(8, "0"),
    ...Array.from(payload, (byte) => byte.toString(2).padStart(8, "0")),
    "0000",
  ].join("")
  return Uint8Array.from(bits.match(/.{8}/g) ?? [], (byte) => parseInt(byte, 2))
}

describe("decodeSeedQr", () => {
  describe("Standard SeedQR", () => {
    it("decodes 48 digits into the 12 words they index", () => {
      expect(decodeSeedQr({ text: standardDigits(PHRASE_12) })).toEqual({
        status: SeedQrStatus.Ok,
        words: PHRASE_12.split(" "),
      })
    })

    it("rejects a phrase whose checksum fails", () => {
      const digits = `${standardDigits(PHRASE_12).slice(0, 44)}0000`
      expect(decodeSeedQr({ text: digits })).toEqual({ status: SeedQrStatus.Invalid })
    })

    it("rejects an index past the end of the wordlist", () => {
      const digits = `9999${standardDigits(PHRASE_12).slice(4)}`
      expect(decodeSeedQr({ text: digits })).toEqual({ status: SeedQrStatus.Invalid })
    })

    it("names a 24-word code as unsupported rather than invalid", () => {
      expect(decodeSeedQr({ text: standardDigits(PHRASE_24) })).toEqual({
        status: SeedQrStatus.Only12Words,
      })
    })

    it("treats any other run of digits as not a SeedQR", () => {
      expect(decodeSeedQr({ text: "5551234567" })).toEqual({
        status: SeedQrStatus.NotSeedQr,
      })
    })
  })

  describe("CompactSeedQR", () => {
    it("decodes the 16 entropy bytes into the same words as the Standard code", () => {
      expect(decodeSeedQr({ rawBytes: compactBytes(PHRASE_12) })).toEqual({
        status: SeedQrStatus.Ok,
        words: PHRASE_12.split(" "),
      })
    })

    it("decodes the bytes when the scanner hands back the QR bitstream", () => {
      expect(
        decodeSeedQr({ rawBytes: byteModeBitstream(compactBytes(PHRASE_12)) }),
      ).toEqual({ status: SeedQrStatus.Ok, words: PHRASE_12.split(" ") })
    })

    /** 40 00 also reads as byte-mode packaging of no text at all (1 seed in 4096). */
    it("decodes entropy that starts 40 00 instead of reading it as empty text", () => {
      const entropy = new Uint8Array(16).fill(0xff)
      entropy.set([0x40, 0x00])
      expect(decodeSeedQr({ rawBytes: entropy })).toEqual({
        status: SeedQrStatus.Ok,
        words: entropyToMnemonic(Buffer.from(entropy).toString("hex")).split(" "),
      })
    })

    it("names a 24-word code as unsupported", () => {
      expect(decodeSeedQr({ rawBytes: compactBytes(PHRASE_24) })).toEqual({
        status: SeedQrStatus.Only12Words,
      })
    })

    it("says a binary code it could only read as text is unreadable", () => {
      expect(decodeSeedQr({ text: "\u0000\u0013ÿ�" })).toEqual({
        status: SeedQrStatus.Unreadable,
      })
    })
  })

  /** 16 characters: the size of a CompactSeedQR, so only the content tells them apart. */
  it("does not take a 16-character text code for a CompactSeedQR", () => {
    const text = "https://blink.sv"
    const bytes = Uint8Array.from(Buffer.from(text, "utf8"))
    expect(bytes).toHaveLength(16)
    expect(decodeSeedQr({ text, rawBytes: bytes })).toEqual({
      status: SeedQrStatus.NotSeedQr,
    })
    expect(decodeSeedQr({ text, rawBytes: byteModeBitstream(bytes) })).toEqual({
      status: SeedQrStatus.NotSeedQr,
    })
  })

  it("does not import a seed when a URL is paired with hostile raw bytes", () => {
    const text = "https://blink.sv"
    const hostile = new Uint8Array(16).fill(0xff)
    expect(decodeSeedQr({ text, rawBytes: hostile })).toEqual({
      status: SeedQrStatus.NotSeedQr,
    })
    expect(Object.keys(decodeSeedQr({ text, rawBytes: hostile }))).toEqual(["status"])
  })

  it("does not treat URL packaging padded to 32 bytes as a 24-word seed", () => {
    const url = Uint8Array.from(Buffer.from("https://blink.sv", "utf8"))
    const packed = byteModeBitstream(url)
    const padded = new Uint8Array(32)
    padded.set(packed)
    expect(decodeSeedQr({ rawBytes: padded })).toEqual({ status: SeedQrStatus.NotSeedQr })
  })

  it("does not treat one character of text padded to 16 bytes as a seed", () => {
    const packed = byteModeBitstream(Uint8Array.from(Buffer.from("a", "utf8")))
    const padded = new Uint8Array(16)
    for (let i = packed.length; i < padded.length; i += 1) {
      padded[i] = (i - packed.length) % 2 === 0 ? 0xec : 0x11
    }
    padded.set(packed)
    expect(decodeSeedQr({ rawBytes: padded })).toEqual({ status: SeedQrStatus.NotSeedQr })
  })

  it("rejects ordinary QR content as not a SeedQR", () => {
    const text = "lnbc1500n1pj9xexampleinvoice"
    expect(
      decodeSeedQr({ text, rawBytes: Uint8Array.from(Buffer.from(text, "utf8")) }),
    ).toEqual({ status: SeedQrStatus.NotSeedQr })
  })

  it("returns no payload on a rejection", () => {
    const result = decodeSeedQr({ text: `${standardDigits(PHRASE_12).slice(0, 44)}0000` })
    expect(Object.keys(result)).toEqual(["status"])
  })
})
