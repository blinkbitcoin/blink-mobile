/**
 * The Source Sans Pro faces the theme uses, by name.
 *
 * Android loads a `fontFamily` from `fonts/<name>.ttf`, or `<name>_bold.ttf` for a weight of
 * 700 or more, and falls back to Roboto when that file is missing; it has no family called
 * "Source Sans Pro". iOS matches the name to the bundled face. So bold text names the bold
 * face and, on Android, sets no weight.
 */
export const fonts = {
  regular: "SourceSansPro-Regular",
  bold: "SourceSansPro-Bold",
} as const
