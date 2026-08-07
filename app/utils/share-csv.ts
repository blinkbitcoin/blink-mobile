import { Platform } from "react-native"
import Share from "react-native-share"

export const CSV_BASENAME = "blink-transactions"
const CSV_EXTENSION = "csv"
const CSV_MIME_TYPE = "text/csv"

/** Android's react-native-share appends the mime extension, iOS does not, so only iOS carries ".csv". */
const buildCsvFilename = (): string =>
  Platform.OS === "android" ? CSV_BASENAME : `${CSV_BASENAME}.${CSV_EXTENSION}`

/**
 * Opens the native share sheet with a base64-encoded CSV payload. Resolves true when the
 * sheet completes and false when the user dismisses it; a dismissal is a choice, not a
 * failure, so only real errors reject.
 */
export const shareCsvBase64 = async (csvEncoded: string): Promise<boolean> => {
  const result = await Share.open({
    title: CSV_BASENAME,
    filename: buildCsvFilename(),
    url: `data:${CSV_MIME_TYPE};base64,${csvEncoded}`,
    type: CSV_MIME_TYPE,
    failOnCancel: false,
  })
  return result.success
}
