import Share from "react-native-share"

const TEXT_MIME_TYPE = "text/plain"

/**
 * Opens the native share sheet on a text file already on disk. A `file://` URL keeps a
 * multi-MB file off the bridge (unlike the CSV's `data:` URL); on Android it must sit
 * under the app's cache dir, which react-native-share's provider exposes. Resolves true
 * when the sheet completes and false when the user dismisses it; a dismissal is a
 * choice, not a failure, so only real errors reject.
 */
export const shareTextFile = async (
  path: string,
  { title, subject }: { title: string; subject?: string },
): Promise<boolean> => {
  const result = await Share.open({
    title,
    subject,
    url: `file://${path}`,
    type: TEXT_MIME_TYPE,
    failOnCancel: false,
  })
  return result.success
}
