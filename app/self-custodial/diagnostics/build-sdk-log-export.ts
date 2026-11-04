export type SdkLogPart = {
  /** The file the text came from, printed as a section marker. */
  name: string
  text: string
}

/**
 * Since 0.26.1 the SDK prints `HtlcDetails.preimage` as `<redacted>`; this is the
 * backstop for any field a later SDK version adds. A preimage is proof of payment and
 * support never needs it. Matches the field as Rust Debug or JSON prints it: `preimage: Some("…")`,
 * `preimage: "…"`, `"preimage":"…"`.
 */
const PREIMAGE_VALUE = /(preimage"?\s*[:=]\s*(?:Some\()?"?)[0-9a-f]{64}/gi

export const redactPreimages = (text: string): string =>
  text.replace(PREIMAGE_VALUE, "$1<redacted>")

/** Header first, then each file oldest first under its own marker. */
export const buildSdkLogExport = ({
  header,
  parts,
}: {
  header: string
  parts: SdkLogPart[]
}): string => {
  const sections = parts.map(({ name, text }) => `--- ${name} ---\n${text}`)
  return redactPreimages([header, ...sections].join("\n"))
}
