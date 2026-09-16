/**
 * The app's two type faces, by their PostScript names.
 *
 * Android has no family called "Source Sans Pro" and falls back to Roboto for it, and it
 * synthesises a weight rather than reaching for the bold face when `fontWeight` is set. So
 * bold text names the bold file and leaves the weight alone.
 */
export const fonts = {
  regular: "SourceSansPro-Regular",
  bold: "SourceSansPro-Bold",
} as const
