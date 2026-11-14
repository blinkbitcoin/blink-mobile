/**
 * The Source Sans Pro faces the theme uses, by name.
 *
 * Android loads a `fontFamily` from `fonts/<name>.ttf`, or `<name>_bold.ttf` for a weight of
 * 700 or more, and falls back to Roboto when that file is missing; it has no family called
 * "Source Sans Pro". iOS matches the name back to its family and picks the face that fits
 * the text's style, taking the weight from the name when none is set. So bold and italic
 * text name their face and, on Android, set no weight or style; italic on iOS also sets
 * `fontStyle: "italic"`, or it gets the regular face.
 */
export const fonts = {
  regular: "SourceSansPro-Regular",
  bold: "SourceSansPro-Bold",
  italic: "SourceSansPro-Italic",
} as const
