import { Platform, StyleProp, TextStyle } from "react-native"

import { createTheme } from "@rn-vui/themed"

import { light, dark } from "./colors"
import { fonts } from "./fonts"

const theme = createTheme({
  lightColors: light,
  darkColors: dark,
  mode: "light",
  components: {
    Button: {
      containerStyle: {
        borderRadius: 50,
      },
      buttonStyle: {
        paddingHorizontal: 32,
        paddingVertical: 8,
        borderRadius: 50,
      },
    },
    Text: (props, { colors }) => {
      /**
       * Bold picks the bold face by name, with or without a `type`.
       *
       * Android loads `fonts/<fontFamily>.ttf`, or `<fontFamily>_bold.ttf` for a weight of
       * 700 or more, and falls back to Roboto when that file is missing. So on Android bold
       * text must carry no weight. iOS resolves the name to the bundled face; the 700 there
       * only matters if the face is ever missing, where it falls back to the system Bold
       * rather than Regular.
       */
      const universalStyle = {
        color: props.color || colors.black,
        fontFamily: props.bold ? fonts.bold : fonts.regular,
        ...(props.bold && Platform.OS === "ios" ? { fontWeight: "700" as const } : {}),
      }

      const sizeStyle = props.type
        ? {
            h1: {
              fontSize: 24,
              lineHeight: 32,
            },
            h2: {
              fontSize: 20,
              lineHeight: 24,
            },
            p1: {
              fontSize: 18,
              lineHeight: 24,
            },
            p2: {
              fontSize: 16,
              lineHeight: 24,
            },
            p3: {
              fontSize: 14,
              lineHeight: 18,
            },
            p4: {
              fontSize: 12,
              lineHeight: 18,
            },
          }[props.type]
        : {}

      return {
        style: {
          ...universalStyle,
          ...sizeStyle,
        } as StyleProp<TextStyle>,
      }
    },
  },
})

export default theme
